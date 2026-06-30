import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    try {
      const contentType = req.headers.get("content-type") || "";

      let htmlContent = "";

      if (contentType.includes("multipart/form-data")) {
        // 文件上传模式（MCP 调用）
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          return NextResponse.json({ error: "未提供文件" }, { status: 400 });
        }
        htmlContent = await file.text();

        // 同时允许从 formData 更新标题
        const title = formData.get("title") as string | null;
        const updateData: Record<string, unknown> = { content: htmlContent };
        if (title) updateData.title = title;

        const page = await prisma.page.update({
          where: { id },
          data: updateData,
        });
        return NextResponse.json({ success: true, page });
      } else {
        // JSON 模式（直接上传 HTML 字符串）
        const body = await req.json();
        htmlContent = body.content;
        if (!htmlContent || typeof htmlContent !== "string") {
          return NextResponse.json(
            { error: "content 字段必须是非空字符串" },
            { status: 400 },
          );
        }

        const updateData: Record<string, unknown> = { content: htmlContent };
        if (body.title) updateData.title = body.title;

        const page = await prisma.page.update({
          where: { id },
          data: updateData,
        });
        return NextResponse.json({ success: true, page });
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: `上传失败: ${e.message}` },
        { status: 500 },
      );
    }
  },
);
