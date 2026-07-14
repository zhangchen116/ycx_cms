import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

import { withLogging } from "@/lib/api-logger";

const createSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  content: z.string().optional(),
  slug: z.string().min(1, "URL 标识不能为空"),
  type: z.literal("STANDALONE"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  styleId: z.string().optional().nullable(),
});

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const type = searchParams.get("type");

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

  const where: Record<string, unknown> = {};
  if (type) where.type = type;

  const pages = await prisma.page.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      style: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(pages);
});

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { title, content, slug, type: pageType, status, styleId } = parsed.data;

    const page = await prisma.page.create({
      data: {
        title,
        content: content || null,
        slug,
        type: pageType,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        styleId: styleId || null,
      },
      include: {
        style: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "URL 标识已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: `创建失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});
