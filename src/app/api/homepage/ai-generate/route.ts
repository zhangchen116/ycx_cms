import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { requirements, referenceImageUrls } = await req.json();

  const setting = await prisma.setting.findUnique({ where: { key: "llm_api_key" } });
  const apiKey = setting?.value || process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o";

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 API Key" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const systemMsg = `你是 AI 建站工具的内容生成器。根据以下信息生成首页的标题和设置建议。

[用户要求]
${requirements || "创建一个吸引人的首页"}

输出 JSON（不含 markdown 代码块）：
{
  "title": "首页标题"
}`;

        const messages: Array<{ role: string; content: string | unknown[] }> = [
          { role: "system", content: systemMsg },
          { role: "user", content: "请生成首页标题" },
        ];

        if (referenceImageUrls?.length > 0) {
          messages.push({
            role: "user",
            content: referenceImageUrls.map((url: string) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          });
        }

        send("generating", { message: "正在生成首页标题..." });

        const response = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          send("error", { message: `API 错误: ${response.status}` });
          controller.close();
          return;
        }

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "{}";

        let parsed: { title?: string } = {};
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { title: text.slice(0, 50) };
        }

        const setting = await prisma.setting.findUnique({ where: { key: "homepage_page_id" } });
        if (setting?.value && parsed.title) {
          await prisma.page.update({
            where: { id: setting.value },
            data: { title: parsed.title },
          });
        }

        send("done", { title: parsed.title || "首页" });
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "生成失败";
        send("error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
