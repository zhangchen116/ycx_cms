import { getSessionFromRequest } from "@/lib/auth";
import { getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";
import { do_action } from "@/lib/hooks";
import { loadPlugins } from "@/lib/plugin-loader";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  slug: z.string().min(1).optional(),
  content: z.string().min(1, "内容不能为空"),
  excerpt: z.string().optional(),
  categoryId: z.string(),
  tags: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  extendedParams: z.string().optional(), // JSON string for plugin hooks
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const tagId = searchParams.get("tagId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (q) where.OR = [
    { title: { contains: q } },
    { content: { contains: q } },
  ];
  if (tagId) where.tags_rel = { some: { tagId } };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, username: true } },
        images: { orderBy: { sortOrder: "asc" } },
        tags_rel: { include: { tag: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  // 序列化：拼接 tags 字符串 + tagIds 数组（兼容旧前端）
  const postsWithTags = posts.map((p) => ({
    ...p,
    tags: p.tags_rel?.map((pt) => pt.tag.name).join(",") || p.tags || "",
    tagIds: p.tags_rel?.map((pt) => pt.tag.id) || [],
    tags_rel: undefined, // 不暴露关联表细节
  }));

  return NextResponse.json({
    posts: postsWithTags,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const POST = withLogging(async (req: Request) => {
  await loadPlugins(); // 确保插件钩子已注册
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { title, slug, content, excerpt, categoryId, tags, tagIds, extendedParams, status: pStatus } = parsed.data;
    const finalSlug = slug || toSlug(title);

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          title,
          slug: finalSlug,
          content,
          excerpt: excerpt || content.slice(0, 150),
          categoryId,
          authorId: session.userId,
          extendedParams: extendedParams || null,
          tags: tags || (tagIds?.length ? undefined : undefined), // 保留旧字段兼容
          status: pStatus,
          publishedAt: pStatus === "PUBLISHED" ? new Date() : null,
        },
      });

      if (tagIds && tagIds.length > 0) {
        await tx.postTag.createMany({
          data: tagIds.map((tagId) => ({ postId: created.id, tagId })),
        });
        await tx.tag.updateMany({
          where: { id: { in: tagIds } },
          data: { postCount: { increment: 1 } },
        });
      }

      return tx.post.findUnique({
        where: { id: created.id },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, username: true } },
          tags_rel: { include: { tag: true } },
        },
      });
    });

    // 触发 add_page 钩子，插件可处理 extendedParams
    if (post && extendedParams) {
      await do_action("add_page", { post, extendedParams });
    }

    return NextResponse.json(
      { ...post, tags: post?.tags_rel?.map((pt) => pt.tag.name).join(",") || "", tags_rel: undefined },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "URL 标识已存在，请换一个标题" }, { status: 409 });
    }
    return NextResponse.json({ error: `创建失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});
