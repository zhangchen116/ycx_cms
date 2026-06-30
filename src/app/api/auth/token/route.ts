import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = body.userId;

  // SUPER_ADMIN can generate for anyone; others only for themselves
  if (targetUserId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  const userId = targetUserId || session.userId;

  const token = "cms_sk_" + crypto.randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { apiToken: token } });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  return NextResponse.json({ token, username: user?.username });
});

export const DELETE = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = body.userId;

  if (targetUserId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  const userId = targetUserId || session.userId;

  await prisma.user.update({ where: { id: userId }, data: { apiToken: null } });
  return NextResponse.json({ ok: true });
});
