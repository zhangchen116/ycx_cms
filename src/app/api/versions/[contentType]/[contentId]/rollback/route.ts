import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ contentType: string; contentId: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { contentType, contentId } = await params;
  const { versionId } = await req.json();

  const version = await prisma.contentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.contentType !== contentType || version.contentId !== contentId) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  }

  // 保存当前版本为新版本
  if (contentType === "post") {
    const post = await prisma.post.findUnique({ where: { id: contentId } });
    if (post) {
      const latestVersion = await prisma.contentVersion.findFirst({
        where: { contentType, contentId },
        orderBy: { versionNumber: "desc" },
      });

      await prisma.contentVersion.create({
        data: {
          contentType,
          contentId,
          versionNumber: (latestVersion?.versionNumber || 0) + 1,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          tags: post.tags,
          description: "回滚前自动保存",
          authorId: session.userId,
        },
      });

      // 执行回滚
      await prisma.post.update({
        where: { id: contentId },
        data: {
          title: version.title,
          content: version.content,
          excerpt: version.excerpt,
          tags: version.tags,
        },
      });
    }
  } else if (contentType === "page") {
    // 页面回滚 - 页面没有 content 字段，仅回滚标题
    const page = await prisma.page.findUnique({ where: { id: contentId } });
    if (page) {
      await prisma.page.update({
        where: { id: contentId },
        data: { title: version.title },
      });
    }
  }

  return NextResponse.json({ ok: true });
});
