// /api/search — 公开站内搜索端点（供前端 search 插件调用）
// 与 /api/posts GET 的区别：无需登录、始终仅返回 PUBLISHED 帖子、返回精简字段
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

  if (!q) return NextResponse.json({ results: [] });

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q } },
        { content: { contains: q } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      category: { select: { slug: true, name: true } },
    },
  });

  return NextResponse.json({ results: posts });
}
