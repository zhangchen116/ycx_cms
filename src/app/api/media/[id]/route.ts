import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";
import { withLogging } from "@/lib/api-logger";

export const DELETE = withLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete file from disk
  const filePath = join(process.cwd(), "public", media.url);
  await unlink(filePath).catch(() => {});

  await prisma.media.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
