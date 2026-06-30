import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ contentType: string; contentId: string }> }
  ) => {
  const { contentType, contentId } = await params;
  if (!["post", "page"].includes(contentType)) {
    return NextResponse.json({ error: "无效内容类型" }, { status: 400 });
  }

  const versions = await prisma.contentVersion.findMany({
    where: { contentType, contentId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      title: true,
      description: true,
      authorId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
});
