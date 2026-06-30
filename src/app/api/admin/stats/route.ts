import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";
import { getSessionFromRequest } from "@/lib/auth";

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [categoryCount, postCount, publishedCount, recentPosts] = await Promise.all([
    prisma.category.count(),
    prisma.post.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    categoryCount,
    postCount,
    publishedCount,
    recentPosts,
  });
});
