// src/app/api/schema/placeholders/route.ts
import { NextResponse } from "next/server";
import { generatePlaceholderDocs } from "@/lib/placeholder-docs";

/**
  * 返回所有已启用插件的占位符使用规则（纯文本 Markdown）
  * 供 AI Agent 和 MCP Server 调用
  */
export async function GET() {
    try {
        const docs = await generatePlaceholderDocs();
        return new NextResponse(docs, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Placeholder docs error:", err);
        return NextResponse.json(
            { error: "生成占位符文档失败" },
            { status: 500 }
        );
    }
}
