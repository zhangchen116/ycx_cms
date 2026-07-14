import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

const categorySchema = z.object({
  name: z.string().min(1, "分类名不能为空"),
  slug: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      page: { select: { id: true, title: true } },
      _count: { select: { posts: true } },
    },
  });
  return NextResponse.json(categories);
});

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { name, slug, order } = parsed.data;
    const finalSlug = slug || toSlug(name);

    // 检查 slug 唯一性
    const exists = await prisma.category.findUnique({ where: { slug: finalSlug } });
    if (exists) {
      return NextResponse.json({ error: "URL 标识已存在" }, { status: 409 });
    }

    // new category goes to the end of the list
    const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
    const newOrder = (maxOrder._max.order ?? -1) + 1;

    // 创建分类 → 自动创建默认页面
    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        order: order ?? newOrder,
        page: {
          create: {
            title: name,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        },
      },
      include: { page: true },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "URL 标识已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: `创建失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});
