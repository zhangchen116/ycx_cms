import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  order: z.number().int().optional(),
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

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(category);
  } catch (err: any) {
    return NextResponse.json({ error: `更新失败: ${err?.message || "未知错误"}` }, { status: 500 });
  }
});

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
    await prisma.category.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: `删除失败: ${err?.message || "未知错误"}` }, { status: 500 });
    }
  });
