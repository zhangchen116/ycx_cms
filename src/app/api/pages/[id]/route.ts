import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  slug: z.string().min(1).optional(),
  type: z.enum(["CATEGORY", "STANDALONE"]).optional(),
  styleId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  if (categoryId) {
    const page = await prisma.page.findUnique({
      where: { categoryId },
      include: {
        style: { select: { id: true, name: true } },
        referenceImages: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json(page);
  }

  const pages = await prisma.page.findMany({
    include: {
      category: { select: { id: true, name: true, slug: true } },
      style: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(pages);
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

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.status === "PUBLISHED") data.publishedAt = new Date();

    const page = await prisma.page.update({ where: { id }, data });
    return NextResponse.json(page);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "URL 标识已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: `更新失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});

export const DELETE = withLogging(
  async (
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await getSessionFromRequest(_req);
    if (!session) return getAuthErrorResponse();

    const { id } = await params;
    try {
      await prisma.page.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: `删除失败: ${err?.message || "未知错误"}` }, { status: 500 });
    }
  }
);
