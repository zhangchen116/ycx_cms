import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { renderPageContent } from "@/lib/page-renderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const page = await prisma.page.findUnique({
    where: { slug, type: "STANDALONE" },
    select: { title: true, status: true },
  });

  if (!page || page.status !== "PUBLISHED") return { title: "页面不存在" };
  return { title: page.title };
}

export default async function StandalonePage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const page = await prisma.page.findUnique({
    where: { slug, type: "STANDALONE" },
    include: { style: { select: { id: true, name: true } } },
  });

  if (!page || page.status !== "PUBLISHED") notFound();

  if (page.content) {
    const renderedHtml = await renderPageContent(page.content, {
      page: {
        id: page.id,
        title: page.title,
        content: page.content,
      },
      prependHome: false,
    });
    return (
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    );
  }

  // 兜底：无 content 时用简单布局
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
      <div className="prose max-w-none">
        <p className="text-gray-400">暂无内容</p>
      </div>
    </div>
  );
}
