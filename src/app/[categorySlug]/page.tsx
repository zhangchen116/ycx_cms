import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderPageContent } from "@/lib/page-renderer";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug: rawSlug } = await params;
  const categorySlug = decodeURIComponent(rawSlug);

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    include: {
      page: { include: { style: true } },
    },
  });

  if (!category?.page) notFound();

  // 如果页面有 content（含占位符的 HTML），则动态渲染
  if (category.page.content) {
    const renderedHtml = await renderPageContent(category.page.content, {
      page: {
        id: category.page.id,
        title: category.page.title,
        content: category.page.content,
        category: { id: category.id, name: category.name, slug: category.slug },
      },
      prependHome: true,
    });
    return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
  }

  // 兜底：无 content 时使用默认布局
  const posts = await prisma.post.findMany({
    where: { categoryId: category.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: { category: { select: { slug: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{category.page.title}</h1>

      <div className="grid gap-6">
        {posts.map((post) => (
          <article key={post.id} className="border-b pb-6">
            <Link href={`/${categorySlug}/${post.slug}`} className="group">
              <h2 className="text-lg font-medium group-hover:text-blue-600 transition-colors">
                {post.title}
              </h2>
            </Link>
            <p className="text-gray-500 text-sm mt-1">{post.excerpt?.slice(0, 200)}</p>
            <div className="text-xs text-gray-400 mt-2">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-CN") : ""}
              {post.tags && <span> · {post.tags}</span>}
            </div>
          </article>
        ))}
        {posts.length === 0 && (
          <p className="text-gray-400 text-center py-12">暂无文章</p>
        )}
      </div>
    </div>
  );
}
