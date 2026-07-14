import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { categoryId, pageId, requirements, referenceImageUrls } = await req.json();

  // two modes: categoryId for category pages, pageId for standalone pages
  let page: { id: string; title: string };
  let categoryName = "";
  let postCount = 0;
  let styleMd = "default";
  let mode: "category" | "standalone" = "category";

  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { page: { include: { style: true } } },
    });
    if (!category?.page) {
      return Response.json({ error: "分类或页面不存在" }, { status: 404 });
    }
    page = { id: category.page.id, title: category.page.title };
    categoryName = category.name;
    postCount = await prisma.post.count({ where: { categoryId } });
    styleMd = category.page.style?.mdContent || "default";
    mode = "category";
  } else if (pageId) {
    const p = await prisma.page.findUnique({
      where: { id: pageId },
      include: { style: true },
    });
    if (!p) {
      return Response.json({ error: "页面不存在" }, { status: 404 });
    }
    page = { id: p.id, title: p.title };
    styleMd = p.style?.mdContent || "default";
    mode = "standalone";
  } else {
    return Response.json({ error: "缺少 categoryId 或 pageId" }, { status: 400 });
  }

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

        const isStandalone = mode === "standalone";

        const systemContent = isStandalone
          ? `你是 AI 建站工具的内容生成器。根据以下信息生成一个独立页面（如"用户需知"、"关于我们"等）的完整 HTML。
参考图片是用户期望的页面视觉效果，请模仿其排版风格和配色。

[样式模板]
${styleMd}

[页面信息]
当前标题: ${page.title}

[用户要求]
${requirements || "创建一个内容丰富的页面"}

请直接输出完整的 HTML 页面内容（不含 markdown 代码块），使用 Tailwind CSS 类名。`
          : `你是 AI 建站工具的内容生成器。根据以下信息生成一个分类页面。
参考图片是用户期望的页面视觉效果，请模仿其排版风格和配色。

[样式模板]
${styleMd}

[分类信息]
名称: ${categoryName}
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

        if (isStandalone) {
          // standalone: save raw HTML as page content
          const cleaned = rawContent.replace(/```html\s*|```\s*/g, "").trim();
          await prisma.page.update({
            where: { id: page.id },
            data: { content: cleaned },
          });
          send("done", { pageId: page.id, content: cleaned, contentUpdated: true });
        } else {
          // category: parse JSON, update title, create sample posts
          const cleaned = rawContent.replace(/```json\s*|\s*```/g, "").trim();
          const parsed = JSON.parse(cleaned);

          // update page title
          await prisma.page.update({
            where: { id: page.id },
            data: { title: parsed.pageTitle || page.title },
          });

          // create sample posts
          const createdPosts = [];
          for (const sp of parsed.samplePosts || []) {
            const slug = sp.title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").slice(0, 80);
            const post = await prisma.post.create({
              data: {
                title: sp.title,
                slug,
                content: sp.content,
                excerpt: sp.excerpt || sp.content.slice(0, 150),
                categoryId: categoryId!,
                authorId: session.userId,
                tags: sp.tags || null,
                status: "DRAFT",
                aiGenerated: true,
              },
            });
            createdPosts.push(post);
          }

          send("done", { pageId: page.id, posts: createdPosts });
        }
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
