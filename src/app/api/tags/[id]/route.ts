import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

// PUT /api/tags/[id] — 重命名标签
export const PUT = withLogging(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { id } = await ctx.params;
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || name.length > 50) {
      return NextResponse.json({ error: "标签名无效" }, { status: 400 });
    }

    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "标签名已存在" }, { status: 409 });
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: { name, slug: name },
    });
    return NextResponse.json(tag);
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }
    return NextResponse.json({ error: `更新失败: ${err?.message}` }, { status: 500 });
  }
});

// DELETE /api/tags/[id] — 删除标签（CASCADE 自动清 PostTag 关联）
export const DELETE = withLogging(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { id } = await ctx.params;
  try {
    await prisma.tag.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }
    return NextResponse.json({ error: `删除失败: ${err?.message}` }, { status: 500 });
  }
});
