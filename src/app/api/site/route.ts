import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [categories, postCounts, drafts, recentPosts, homepageSetting] = await Promise.all([
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, slug: true, category: { select: { slug: true, name: true } } },
    }),
    prisma.setting.findUnique({ where: { key: "homepage_page_id" } }),
  ]);

  let homepageTitle = "AI CMS";
  if (homepageSetting) {
    const page = await prisma.page.findUnique({ where: { id: homepageSetting.value } });
    if (page) homepageTitle = page.title;
  }

  return NextResponse.json({
    homepageTitle,
    totalPosts: postCounts,
    totalDrafts: drafts,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      postCount: c._count.posts,
    })),
    recentPosts: recentPosts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category.slug,
      categoryName: p.category.name,
    })),
  });
});
