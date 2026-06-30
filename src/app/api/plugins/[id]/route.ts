import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

// GET /api/plugins/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plugin = await prisma.plugin.findUnique({ where: { id } });
  if (!plugin) return NextResponse.json({ error: "插件不存在" }, { status: 404 });
  return NextResponse.json(plugin);
}

// DELETE /api/plugins/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.plugin.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
