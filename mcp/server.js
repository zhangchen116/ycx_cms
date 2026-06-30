#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.CMS_API_URL || "http://localhost:3000/";
const TOKEN = process.env.CMS_API_TOKEN || "";

async function api(method, path, body) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CMS API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function fmtPosts(posts) {
  if (!posts.length) return "(空)";
  return posts
    .map(
      (p) =>
        `- [${p.status || ""}] ${p.title} (slug: ${p.slug}, 分类: ${p.category?.name || "—"})`
    )
    .join("\n");
}

function fmtCategories(cats) {
  if (!cats.length) return "(空)";
  return cats.map((c) => `- ${c.name} (slug: ${c.slug}, ${c._count?.posts ?? c.postCount ?? 0} 篇)`).join("\n");
}

const TOOLS = {
  cms_site_info: {
    description: "获取站点状态概览：首页标题、分类列表及帖子数、最近帖子",
    handler: async () => {
      const info = await api("GET", "/api/site");
      return [
        `首页标题: ${info.homepageTitle}`,
        `已发布帖子: ${info.totalPosts} | 草稿: ${info.totalDrafts}`,
        ``,
        `分类:`,
        fmtCategories(info.categories),
        ``,
        `最近 10 篇:`,
        fmtPosts(info.recentPosts.map((p) => ({
          title: p.title,
          slug: p.slug,
          status: "PUBLISHED",
          category: { name: p.categoryName },
        }))),
      ].join("\n");
    },
  },

  cms_list_categories: {
    description: "列出所有分类",
    handler: async () => {
      const cats = await api("GET", "/api/categories");
      if (!cats.length) return "(暂无分类)";
      return fmtCategories(cats);
    },
  },

  cms_list_posts: {
    description: "列出/搜索帖子。可选参数: categoryId, status, search, tagId, page",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "按分类 ID 筛选" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED"], description: "按状态筛选" },
        search: { type: "string", description: "标题关键词搜索" },
        tagId: { type: "string", description: "按标签 ID 筛选" },
        page: { type: "number", default: 1 },
      },
    },
    handler: async (args) => {
      const qs = new URLSearchParams();
      if (args.categoryId) qs.set("categoryId", args.categoryId);
      if (args.status) qs.set("status", args.status);
      if (args.search) qs.set("q", args.search);
      if (args.tagId) qs.set("tagId", args.tagId);
      if (args.page) qs.set("page", String(args.page));
      const qstr = qs.toString() ? `?${qs}` : "";
      const data = await api("GET", `/api/posts${qstr}`);
      if (!data.posts?.length) return "(暂无帖子)";
      return `共 ${data.pagination.total} 篇，第 ${data.pagination.page}/${data.pagination.totalPages} 页:\n${fmtPosts(data.posts)}`;
    },
  },

  cms_get_post: {
    description: "获取帖子详情（含 HTML 内容）",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "帖子 ID" } },
      required: ["id"],
    },
    handler: async (args) => {
      const post = await api("GET", `/api/posts/${args.id}`);
      return [
        `标题: ${post.title}`,
        `slug: ${post.slug}`,
        `状态: ${post.status}`,
        `分类: ${post.category?.name || "—"}`,
        `标签: ${post.tags || "—"}`,
        `摘要: ${post.excerpt || "—"}`,
        `配图: ${post.imageUrl || "—"}`,
        `发布时间: ${post.publishedAt || "—"}`,
        ``,
        `--- 内容 ---`,
        post.content || "(空)",
      ].join("\n");
    },
  },

  cms_create_post: {
    description: "创建新帖子（content 为 HTML）",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        slug: { type: "string", description: "URL slug，不填自动生成" },
        content: { type: "string", description: "HTML 正文内容" },
        categoryId: { type: "string" },
        tagIds: { type: "array", items: { type: "string" }, description: "标签 ID 列表" },
        excerpt: { type: "string", description: "摘要" },
        imageUrl: { type: "string", description: "配图 URL" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED"], default: "PUBLISHED" },
        extendedParams: { type: "string", description: "扩展参数（JSON 字符串），用于插件扩展帖子的额外字段，如 sku、price、stock 等" },
      },
      required: ["title", "content", "categoryId"],
    },
    handler: async (args) => {
      const post = await api("POST", "/api/posts", args);
      return `✅ 帖子已创建: ${post.title} (id: ${post.id}, slug: ${post.slug})`;
    },
  },

  cms_update_post: {
    description: "更新帖子",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        tagIds: { type: "array", items: { type: "string" } },
        excerpt: { type: "string" },
        imageUrl: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
        extendedParams: { type: "string", description: "扩展参数（JSON 字符串），用于插件扩展帖子的额外字段，如 sku、price、stock 等" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const { id, ...rest } = args;
      const post = await api("PATCH", `/api/posts/${id}`, rest);
      return `✅ 帖子已更新: ${post.title}`;
    },
  },

  cms_list_tags: {
    description: "列出所有标签（搜索、排序）",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "标签名搜索" },
        orderBy: { type: "string", enum: ["name", "postCount"], default: "postCount" },
      },
    },
    handler: async (args) => {
      const qs = new URLSearchParams();
      if (args.q) qs.set("q", args.q);
      if (args.orderBy) qs.set("orderBy", args.orderBy);
      const qstr = qs.toString() ? `?${qs}` : "";
      const data = await api("GET", `/api/tags${qstr}`);
      if (!data.tags?.length) return "(暂无标签)";
      return data.tags
        .map((t) => `- ${t.name} (id: ${t.id}, slug: ${t.slug}, ${t.postCount}篇)`)
        .join("\n");
    },
  },

  cms_create_tag: {
    description: "创建标签",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    handler: async (args) => {
      const tag = await api("POST", "/api/tags", { name: args.name });
      return `✅ 标签已创建: ${tag.name} (id: ${tag.id})`;
    },
  },

  cms_get_homepage: {
    description: "获取首页内容",
    handler: async () => {
      const page = await api("GET", "/api/homepage");
      return [
        `标题: ${page.title}`,
        `描述: ${page.description || "—"}`,
        ``,
        `--- 内容 ---`,
        page.content || "(空)",
      ].join("\n");
    },
  },

  cms_upload_media: {
    description: "上传媒体文件（图片）。返回 URL 供 cms_create_post/cms_update_page_html 使用",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地图片文件绝对路径" },
      },
      required: ["filePath"],
    },
    handler: async (args) => {
      const fs = await import("fs");
      const path = await import("path");
      const file = fs.readFileSync(args.filePath);
      const filename = path.basename(args.filePath);
      const ext = filename.split(".").pop().toLowerCase();
      const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
      const mimeType = mimeMap[ext] || "image/png";

      const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      const body = Buffer.concat([Buffer.from(header), file, Buffer.from(footer)]);

      const res = await fetch(`${BASE}/api/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      return `✅ 上传成功\n文件名: ${data.filename}\nURL: ${BASE}${data.url}`;
    },
  },

  cms_get_page_schema: {
    description: "获取页面编辑 Schema，包含可用字段、占位符规范、示例 HTML。AI Agent 在生成页面 HTML 前应先调用此工具",
    handler: async () => {
      const schema = await api("GET", "/api/schema/page");
      return [
        `=== CMS 页面 Schema v${schema.version} ===`,
        ``,
        `--- 可编辑字段 ---`,
        Object.entries(schema.fields)
          .map(([k, v]) => `- ${k}: ${v.type}${v.required ? " (必填)" : ""} — ${v.description}`)
          .join("\n"),
        ``,
        `--- 动态占位符 ---`,
        ``,
        `1. 静态绑定 data-cms-bind="<source>.<field>"`,
        Object.entries(schema.placeholders.staticBind.sources)
          .map(([k, v]) => `   ${k}: ${v}`)
          .join("\n"),
        ``,
        `2. 文章列表 data-cms-posts [data-category] [data-limit] [data-order]`,
        `   模板内绑定:`,
        Object.entries(schema.placeholders.postsList.templateBindings)
          .map(([k, v]) => `   ${k}: ${v}`)
          .join("\n"),
        ``,
        `3. 分类列表 data-cms-categories`,
        `   模板内绑定:`,
        Object.entries(schema.placeholders.categoriesList.templateBindings)
          .map(([k, v]) => `   ${k}: ${v}`)
          .join("\n"),
        ``,
        `--- 页面类型 ---`,
        ...Object.entries(schema.pageTypes).map(
          ([k, v]) => `${k}: ${v.description}`
        ),
        ``,
        `--- 示例 ---`,
        schema.placeholders.postsList.example,
        ``,
        schema.placeholders.categoriesList.example,
      ].join("\n");
    },
  },

  // mcp/server.js —— 在 cms_get_page_schema 之后添加

  cms_get_placeholder_rules: {
    description:
      "获取所有已启用插件的占位符使用规则（含 data-cms-plugin 用法、参数说明、插件工作流文档）。AI Agent 在生成含插件组件的页面 HTML 前应调用此工具",
    handler: async () => {
      const res = await fetch(`${BASE}api/schema/placeholders`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`获取占位符规则失败: ${res.status} ${text}`);
      }
      const docs = await res.text();
      return docs || "";
    },
  },

  cms_upload_page_html: {
    description: "上传 HTML 文件到指定页面。HTML 中可包含 data-cms-* 占位符，服务器会在渲染时替换为实际数据",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "目标页面 ID" },
        filePath: { type: "string", description: "本地 HTML 文件绝对路径" },
        title: { type: "string", description: "可选，同时更新页面标题" },
      },
      required: ["pageId", "filePath"],
    },
    handler: async (args) => {
      const fs = await import("fs");
      const path = await import("path");

      if (!fs.existsSync(args.filePath)) {
        throw new Error(`文件不存在: ${args.filePath}`);
      }

      const file = fs.readFileSync(args.filePath);
      const filename = path.basename(args.filePath);
      const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);

      let bodyParts = [];
      bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/html\r\n\r\n`);
      bodyParts.push(file);
      if (args.title) {
        bodyParts.push(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${args.title}`);
      }
      bodyParts.push(`\r\n--${boundary}--\r\n`);

      const bodyBuffer = Buffer.concat(bodyParts.map(p =>
        typeof p === "string" ? Buffer.from(p) : p
      ));

      const res = await fetch(`${BASE}/api/pages/${args.pageId}/upload-html`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`上传失败: ${res.status} ${text}`);
      }

      const data = await res.json();
      return `✅ 页面 HTML 已上传\n页面 ID: ${data.page.id}\n标题: ${data.page.title}`;
    },
  },

  cms_render_page: {
    description: "预览页面的渲染结果（将占位符替换为实际数据后的完整 HTML）",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "页面 ID" },
      },
      required: ["pageId"],
    },
    handler: async (args) => {
      const res = await fetch(`${BASE}/api/pages/${args.pageId}/render`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`渲染失败: ${res.status} ${text}`);
      }
      const html = await res.text();
      // 截断过长的返回内容
      return html.length > 10000
        ? `✅ 渲染成功 (${html.length} 字符)\n--- 前 10000 字符 ---\n${html.slice(0, 10000)}\n... (已截断)`
        : `✅ 渲染成功\n--- 渲染结果 ---\n${html}`;
    },
  },
};

const server = new Server(
  { name: "cms-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    inputSchema: t.inputSchema || { type: "object", properties: {} },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS[request.params.name];
  if (!tool) throw new Error(`未知工具: ${request.params.name}`);
  try {
    const result = await tool.handler(request.params.arguments || {});
    return { content: [{ type: "text", text: result }] };
  } catch (e) {
    return { content: [{ type: "text", text: `错误: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
