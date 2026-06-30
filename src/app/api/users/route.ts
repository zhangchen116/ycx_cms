import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

const createUserSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]).default("EDITOR"),
});

async function checkAdmin(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }
  return null;
}

export const GET = withLogging(async (req: Request) => {
  const err = await checkAdmin(req);
  if (err) return err;

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, apiToken: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users.map((u) => ({ ...u, hasToken: !!u.apiToken, apiToken: undefined })));
});

export const POST = withLogging(async (req: Request) => {
  const err = await checkAdmin(req);
  if (err) return err;

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (exists) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }

    const password = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: { username: parsed.data.username, password, role: parsed.data.role },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
});
