import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { renderPageContent } from "@/lib/page-renderer";

/**
 * GET /api/pages/:id/render
 * 渲染页面 HTML（替换所有动态占位符为实际数据），返回最终 HTML
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const page = await prisma.page.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!page) {
    return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  }

  if (!page.content) {
    return NextResponse.json(
      { error: "该页面尚未设置 HTML 内容" },
      { status: 400 },
    );
  }

  try {
    const renderedHtml = await renderPageContent(page.content, {
      page: {
        id: page.id,
        title: page.title,
        content: page.content,
        category: page.category,
      },
    });

    return new NextResponse(renderedHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `渲染失败: ${e.message}` },
      { status: 500 },
    );
  }
}
