import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const PATCH = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { id, direction } = await req.json();
  if (!id || !["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  }

  // find adjacent category by order
  const adjacent = await prisma.category.findFirst({
    where: {
      id: { not: id },
      order: direction === "up" ? { lt: current.order } : { gt: current.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });

  if (!adjacent) {
    return NextResponse.json({ ok: true, message: "已在边界" });
  }

  // swap orders
  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { order: adjacent.order } }),
    prisma.category.update({ where: { id: adjacent.id }, data: { order: current.order } }),
  ]);

  return NextResponse.json({ ok: true });
});
