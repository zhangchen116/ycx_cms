import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderPageContent } from "@/lib/page-renderer";

export default async function HomePage() {
  const session = await getSession();
  const isAdmin = !!session;

  const homepageSetting = await prisma.setting.findUnique({
    where: { key: "homepage_page_id" },
  });

  let page = null;
  if (homepageSetting?.value) {
    page = await prisma.page.findUnique({
      where: { id: homepageSetting.value },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  // 如果页面有 content（含占位符的 HTML），则动态渲染
  if (page?.content) {
    const renderedHtml = await renderPageContent(page.content, {
      page: {
        id: page.id,
        title: page.title,
        content: page.content,
        category: page.category ?? undefined,
      },
    });
    return (
      <>
        {isAdmin && (
          <div className="max-w-4xl mx-auto px-4 py-2">
            <a href="/admin/homepage" className="text-sm text-blue-600 hover:underline">
              编辑首页
            </a>
          </div>
        )}
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </>
    );
  }

  // 兜底：无 content 时使用默认布局
  const [categories, recentPosts] = await Promise.all([
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
      },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 10,
      include: {
        category: { select: { name: true, slug: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{page?.title || "AI CMS"}</h1>
          <div className="flex gap-3 items-center">
            {isAdmin && (
              <a href="/admin/homepage" className="text-sm text-blue-600 hover:underline">
                编辑首页
              </a>
            )}
            <Link href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600">
              管理后台
            </Link>
          </div>
        </div>
        <nav className="flex gap-4 border-b pb-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              {c.name}
              {c._count.posts > 0 && (
                <span className="text-xs text-gray-400 ml-1">({c._count.posts})</span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-6">最新文章</h2>
        <div className="grid gap-6">
          {recentPosts.map((post) => (
            <article key={post.id} className="border-b pb-6">
              <Link href={`/${post.category.slug}/${post.slug}`} className="group">
                <h3 className="text-lg font-medium group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h3>
              </Link>
              <p className="text-gray-500 text-sm mt-1">
                {post.excerpt?.slice(0, 200)}
              </p>
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <Link href={`/${post.category.slug}`} className="hover:text-blue-600">
                  {post.category.name}
                </Link>
                <span>·</span>
                <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-CN") : ""}</span>
                {post.tags && (
                  <>
                    <span>·</span>
                    <span>{post.tags}</span>
                  </>
                )}
              </div>
            </article>
          ))}
          {recentPosts.length === 0 && (
            <p className="text-gray-400 text-center py-12">还没有文章</p>
          )}
        </div>
      </section>
    </div>
  );
}
