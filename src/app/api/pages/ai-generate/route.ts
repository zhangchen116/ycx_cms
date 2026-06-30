import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { categoryId, requirements, referenceImageUrls } = await req.json();
  if (!categoryId) {
    return Response.json({ error: "缺少分类ID" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { page: { include: { style: true } } },
  });
  if (!category?.page) {
    return Response.json({ error: "分类或页面不存在" }, { status: 404 });
  }

  const postCount = await prisma.post.count({ where: { categoryId } });
  const styleMd = category.page.style?.mdContent || "default";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("thinking", { message: "正在分析样式和分类信息..." });

        const apiKey = process.env.LLM_API_KEY;
        const baseURL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.LLM_MODEL || "gpt-4o";

        if (!apiKey) {
          send("error", { message: "未配置 API Key" });
          controller.close();
          return;
        }

        const systemContent = `你是 AI 建站工具的内容生成器。根据以下信息生成一个分类页面。
参考图片是用户期望的页面视觉效果，请模仿其排版风格和配色。

[样式模板]
${styleMd}

[分类信息]
名称: ${category.name}
已有帖子数: ${postCount}

[用户要求]
${requirements || "创建一个吸引人的页面"}

输出 JSON（不含 markdown 代码块）：
{
  "pageTitle": "页面标题",
  "styleConfig": { "columns": 3, "cardStyle": "default", "colorScheme": "light" },
  "samplePosts": [
    { "title": "示例标题", "content": "Markdown 内容", "excerpt": "摘要", "tags": "标签1,标签2" }
  ]
}`;

        const messages: Array<{ role: string; content: string | unknown[] }> = [
          { role: "system", content: systemContent },
        ];

        if (referenceImageUrls?.length > 0) {
          const imageContent = referenceImageUrls.map((url: string) => ({
            type: "image_url" as const,
            image_url: { url },
          }));
          messages[0].content = (messages[0].content as string) + "\n[参考图片]";
          messages.push({ role: "user", content: imageContent });
        }

        send("generating", { message: "正在生成页面内容..." });

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

        // 更新页面标题
        await prisma.page.update({
          where: { id: category.page!.id },
          data: { title: parsed.pageTitle || category.page!.title },
        });

        // 创建示例帖子
        const createdPosts = [];
        for (const sp of parsed.samplePosts || []) {
          const slug = sp.title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").slice(0, 80);
          const post = await prisma.post.create({
            data: {
              title: sp.title,
              slug,
              content: sp.content,
              excerpt: sp.excerpt || sp.content.slice(0, 150),
              categoryId,
              authorId: session.userId,
              tags: sp.tags || null,
              status: "DRAFT",
              aiGenerated: true,
            },
          });
          createdPosts.push(post);
        }

        send("done", { pageId: category.page!.id, posts: createdPosts });
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
