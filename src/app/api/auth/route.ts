import { getSessionFromRequest, getSession, setSessionCookie, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request) => {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    await setSessionCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
});

export const GET = withLogging(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.userId, username: session.username, role: session.role },
  });
});
