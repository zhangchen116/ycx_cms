import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]).optional(),
  password: z.string().min(8).optional(),
}).refine((d) => d.role || d.password, { message: "至少提供 role 或 password" });

export const DELETE = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 保留内容，标记为已删除用户
  await prisma.post.updateMany({
    where: { authorId: id },
    data: { authorId: "deleted" },
  });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

export const PATCH = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (parsed.data.role) data.role = parsed.data.role;
    if (parsed.data.password) data.password = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
});
