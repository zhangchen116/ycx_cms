import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

async function getHomepagePage() {
  const setting = await prisma.setting.findUnique({ where: { key: "homepage_page_id" } });
  if (!setting) return null;
  return prisma.page.findUnique({
    where: { id: setting.value },
    include: {
      style: { select: { id: true, name: true } },
      referenceImages: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();
  const page = await getHomepagePage();
  return NextResponse.json(page);
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  styleId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const PATCH = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: "homepage_page_id" } });
  if (!setting) {
    return NextResponse.json({ error: "首页页面未初始化" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.status === "PUBLISHED") data.publishedAt = new Date();

    const page = await prisma.page.update({ where: { id: setting.value }, data });
    return NextResponse.json(page);
  } catch (err: any) {
    return NextResponse.json({ error: `更新失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});
