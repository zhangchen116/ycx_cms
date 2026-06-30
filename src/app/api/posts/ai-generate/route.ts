import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { categoryId, prompt, imageUrls } = await req.json();
  if (!categoryId || !prompt) {
    return Response.json({ error: "缺少分类ID或生成提示" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { page: { include: { style: true } } },
  });
  if (!category) {
    return Response.json({ error: "分类不存在" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("thinking", { message: "正在生成内容..." });

        const apiKey = process.env.LLM_API_KEY;
        const baseURL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.LLM_MODEL || "gpt-4o";

        if (!apiKey) {
          send("error", { message: "未配置 API Key" });
          controller.close();
          return;
        }

        const messages: Array<{ role: string; content: string | unknown[] }> = [
          {
            role: "system",
            content: `你是内容生成器。根据用户要求生成帖子内容。
${
  imageUrls?.length > 0
    ? "用户上传了配图，请根据图片内容合理安排插入位置并生成配文。图片占位符使用 ![alt](IMG_N) 格式。"
    : ""
}

输出 JSON（不含 markdown 代码块）：
{ "title": "标题", "content": "Markdown 正文", "excerpt": "摘要", "tags": "标签1,标签2" }`,
          },
          {
            role: "user",
            content: `分类: ${category.name}\n要求: ${prompt}`,
          },
        ];

        if (imageUrls?.length > 0) {
          messages.push({
            role: "user",
            content: imageUrls.map((url: string) => ({
              type: "image_url",
              image_url: { url },
            })),
          });
        }

        send("generating", { message: "正在生成..." });

        const response = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          send("error", { message: `API 调用失败: ${response.status}` });
          controller.close();
          return;
        }

        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content || "";
        const cleaned = rawContent.replace(/```json\s*|\s*```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        const slug = parsed.title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").slice(0, 80);
        const post = await prisma.post.create({
          data: {
            title: parsed.title,
            slug,
            content: parsed.content,
            excerpt: parsed.excerpt || parsed.content.slice(0, 150),
            categoryId,
            authorId: session.userId,
            tags: parsed.tags || null,
            status: "DRAFT",
            aiGenerated: true,
          },
          include: {
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, username: true } },
          },
        });

        send("done", { post });
      } catch (e) {
        send("error", { message: `生成失败: ${(e as Error).message}` });
      } finally {
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
