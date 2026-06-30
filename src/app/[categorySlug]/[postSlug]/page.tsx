import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** 从 content 中提取 body HTML，并去除与页面标题重复的 h1 */
function getContentHtml(content: string): string {
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : content;
  // 去掉第一个 h1 标签（页面已渲染 post.title），保留其他内容
  html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  return html;
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ categorySlug: string; postSlug: string }>;
}) {
  const { categorySlug: rawCatSlug, postSlug: rawPostSlug } = await params;
  const categorySlug = decodeURIComponent(rawCatSlug);
  const postSlug = decodeURIComponent(rawPostSlug);

  const post = await prisma.post.findFirst({
    where: {
      slug: postSlug,
      category: { slug: categorySlug },
      status: "PUBLISHED",
    },
    include: {
      category: { select: { name: true, slug: true } },
      author: { select: { username: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!post) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-sm text-gray-400 mb-4 space-x-2">
        <Link href="/" className="hover:text-gray-600">首页</Link>
        <span>/</span>
        <Link href={`/${categorySlug}`} className="hover:text-gray-600">{post.category.name}</Link>
      </div>

      <article>
        <h1 className="text-3xl font-bold mb-3">{post.title}</h1>
        <div className="flex gap-3 text-sm text-gray-400 mb-8">
          <span>{post.author.username}</span>
          <span>·</span>
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-CN") : ""}</span>
          {post.tags && (
            <>
              <span>·</span>
              <span>{post.tags}</span>
            </>
          )}
        </div>

        <div
          className="prose max-w-none"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: getContentHtml(post.content) }}
        />
      </article>

      {post.images.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold mb-3">配图</h3>
          <div className="grid grid-cols-3 gap-4">
            {post.images.map((img) => (
              <img key={img.id} src={img.url} alt={`配图`} className="rounded-lg w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
