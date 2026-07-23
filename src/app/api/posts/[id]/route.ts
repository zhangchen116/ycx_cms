import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { do_action } from "@/lib/hooks";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  extendedParams: z.string().nullable().optional(),
});

export const GET = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      author: { select: { id: true, username: true } },
      images: { orderBy: { sortOrder: "asc" } },
      tags_rel: { include: { tag: true } },
    },
  });

  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  return NextResponse.json({
    ...post,
    tags: post.tags_rel?.map((pt) => pt.tag.name).join(",") || post.tags || "",
    tagIds: post.tags_rel?.map((pt) => pt.tag.id) || [],
    tags_rel: undefined,
  });
});

export const PATCH = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { tagIds, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (data.status === "PUBLISHED") {
      data.publishedAt = new Date();
    }

    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data,
      });

      // 同步标签关联
      if (tagIds !== undefined) {
        const oldTags = await tx.postTag.findMany({ where: { postId: id } });
        const oldIds = new Set(oldTags.map((t) => t.tagId));
        const newIds = new Set(tagIds);

        // 删除旧的
        const toRemove = oldTags.filter((t) => !newIds.has(t.tagId));
        if (toRemove.length > 0) {
          await tx.postTag.deleteMany({
            where: { postId: id, tagId: { in: toRemove.map((t) => t.tagId) } },
          });
          await tx.tag.updateMany({
            where: { id: { in: toRemove.map((t) => t.tagId) } },
            data: { postCount: { decrement: 1 } },
          });
        }

        // 添加新的
        const toAdd = tagIds.filter((tid) => !oldIds.has(tid));
        if (toAdd.length > 0) {
          await tx.postTag.createMany({
            data: toAdd.map((tagId) => ({ postId: id, tagId })),
          });
          await tx.tag.updateMany({
            where: { id: { in: toAdd } },
            data: { postCount: { increment: 1 } },
          });
        }
      }

      return tx.post.findUnique({
        where: { id },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, username: true } },
          images: { orderBy: { sortOrder: "asc" } },
          tags_rel: { include: { tag: true } },
        },
      });
    });

    // 触发 add_page 钩子，插件可处理 extendedParams
    if (post && parsed.data.extendedParams) {
      await do_action("add_page", { post, extendedParams: parsed.data.extendedParams });
    }

    return NextResponse.json({
      ...post,
      tags: post?.tags_rel?.map((pt) => pt.tag.name).join(",") || "",
      tagIds: post?.tags_rel?.map((pt) => pt.tag.id) || [],
      tags_rel: undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `更新失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});

// DELETE: CASCADE 自动删除 PostTag 关联，需手动维护 postCount
export const DELETE = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      // 先查出关联的标签，递减 postCount
      const postTags = await tx.postTag.findMany({ where: { postId: id } });
      if (postTags.length > 0) {
        await tx.tag.updateMany({
          where: { id: { in: postTags.map((pt) => pt.tagId) } },
          data: { postCount: { decrement: 1 } },
        });
      }
      await tx.post.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: `删除失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});
