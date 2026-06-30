import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  if (categoryId) {
    const page = await prisma.page.findUnique({
      where: { categoryId },
      include: {
        style: { select: { id: true, name: true } },
        referenceImages: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json(page);
  }

  const pages = await prisma.page.findMany({
    include: {
      category: { select: { id: true, name: true, slug: true } },
      style: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(pages);
});
