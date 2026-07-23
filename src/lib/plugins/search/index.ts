// search 插件 — 基于 Orama 的站内全文搜索（CJK 分词 + API 路由）
import { create, insertMultiple, remove as oramaRemove, upsert as oramaUpsert, search as oramaSearch } from "@orama/orama";
import { add_action, add_filter } from "@/lib/hooks";
import { register_placeholder } from "@/lib/placeholder-registry";
import { registerPluginApiRoute } from "@/lib/plugin-loader";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// ──── CJK Bigram 分词器 ────

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{3000}-\u{303f}\uff00-\uffef]/u;

function tokenizeCJK(input: string): string[] {
  const tokens: string[] = [];
  const segments = input.split(/\s+/);
  for (const seg of segments) {
    if (!seg) continue;
    if (CJK_RE.test(seg)) {
      const chars = [...seg].filter((c) => CJK_RE.test(c) || /\w/.test(c));
      // 双字词 (bigram)
      for (let i = 0; i < chars.length - 1; i++) {
        tokens.push(chars[i] + chars[i + 1]);
      }
      // 单字 (unigram)，保证单字搜索也能命中
      for (const ch of chars) {
        tokens.push(ch);
      }
    } else {
      // 英文/数字：原样保留，Orama 内置分词处理
      tokens.push(seg.toLowerCase());
    }
  }
  return tokens;
}

function cjkTokenizer() {
  return {
    language: "english",
    normalizationCache: new Map<string, string>(),
    tokenize(raw: string) {
      return tokenizeCJK(raw);
    },
  };
}

// ──── Orama 索引单例 ────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oramaDB: any = null;

/** 从数据库全量重建 Orama 索引 */
async function rebuildIndex() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      slug: true,
      category: { select: { slug: true, name: true } },
    },
  });

  oramaDB = await create({
    schema: {
      id: "string",
      title: "string",
      content: "string",
      excerpt: "string",
      slug: "string",
      categorySlug: "string",
      categoryName: "string",
    } as const,
    components: { tokenizer: cjkTokenizer() },
  });

  if (posts.length > 0) {
    await insertMultiple(oramaDB,
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        excerpt: p.excerpt || "",
        slug: p.slug,
        categorySlug: p.category.slug,
        categoryName: p.category.name,
      })),
    );
  }

  console.log(`[Search] 索引已构建，共 ${posts.length} 篇文章`);
}

// ──── 搜索 Handler（API 路由） ────

async function handleSearch(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

  if (!q || !oramaDB) {
    return NextResponse.json({ results: [] });
  }

  const result = await oramaSearch(oramaDB, { term: q.trim(), limit });

  const items = result.hits.map((h) => ({
    title: h.document.title,
    slug: h.document.slug,
    excerpt: h.document.excerpt,
    category: {
      slug: h.document.categorySlug,
      name: h.document.categoryName,
    },
    _score: h.score,
  }));

  return NextResponse.json({ results: items });
}

// ──── 前端全局搜索 API ────

const SEARCH_API_JS = /* javascript */ `
(function() {
  window.CMSSearch = {
    async search(query, options = {}) {
      if (!query?.trim()) return [];
      const limit = Math.min(options.limit ?? 5, 20);
      const res = await fetch('/api/plugin/search/search?q=' + encodeURIComponent(query.trim()) + '&limit=' + limit);
      const data = await res.json();
      return data.results || [];
    },

    getPostUrl(post) {
      return '/' + (post.category?.slug || '') + '/' + post.slug;
    },

    truncateExcerpt(excerpt, maxLength = 60) {
      return excerpt ? excerpt.replace(/<[^>]*>/g, '').slice(0, maxLength) + '...' : '';
    }
  };

  window.cmsSearch = window.CMSSearch;
})();
`;

function renderSearch(_attrs: Record<string, string>, config: Record<string, unknown>): string {
  const dataAttrs = Object.entries(config)
    .map(([key, value]) => `data-search-${key}="${value}"`)
    .join(' ');

  return `<div class="cms-plugin cms-plugin-search" ${dataAttrs}></div>`;
}

// ──── 插件入口 ────

export default async function register(_config: Record<string, unknown>) {
  await rebuildIndex();
  registerPluginApiRoute("search", "GET", "/search", handleSearch as any);

  add_action("register_placeholders", () => {
    register_placeholder("search", renderSearch, "search",
      '站内全文搜索插件（Orama 引擎，支持中文分词）。\n\n' +
      '插件提供全局 JS API `window.CMSSearch`，UI 完全由用户自定义。\n\n' +
      '=== 全局 API ===\n' +
      '```javascript\n' +
      '// 执行搜索\n' +
      'const results = await window.CMSSearch.search("关键词", { limit: 10 });\n' +
      '\n' +
      '// 获取文章 URL\n' +
      'const url = window.CMSSearch.getPostUrl(post);\n' +
      '\n' +
      '// 简化摘要（去除HTML标签）\n' +
      'const excerpt = window.CMSSearch.truncateExcerpt(post.excerpt, 60);\n' +
      '```\n\n' +
      '=== 返回值结构 ===\n' +
      '```typescript\n' +
      'interface SearchResult {\n' +
      '  title: string;        // 文章标题\n' +
      '  slug: string;         // 文章 slug\n' +
      '  excerpt: string;      // 文章摘要\n' +
      '  category: {\n' +
      '    slug: string;       // 分类 slug\n' +
      '    name: string;       // 分类名称\n' +
      '  };\n' +
      '  _score: number;       // 匹配分数（0-1）\n' +
      '}\n' +
      '```\n\n' +
      '=== 自定义 UI 示例 ===\n' +
      '```html\n' +
      '<style>\n' +
      '.my-search { max-width: 500px; margin: 1rem auto; }\n' +
      '.my-input { width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; }\n' +
      '.my-results { margin-top: 0.5rem; border: 1px solid #e5e7eb; }\n' +
      '.my-result { padding: 0.5rem; border-bottom: 1px solid #f3f4f6; }\n' +
      '.my-result:last-child { border-bottom: none; }\n' +
      '</style>\n' +
      '<div class="my-search">\n' +
      '  <input type="text" class="my-input" id="search-input" placeholder="搜索文章...">\n' +
      '  <div class="my-results" id="search-results"></div>\n' +
      '</div>\n' +
      '<script>\n' +
      'document.querySelector("#search-input").addEventListener("input", async function(e) {\n' +
      '  const q = e.target.value;\n' +
      '  const results = await window.CMSSearch.search(q, { limit: 5 });\n' +
      '  const container = document.querySelector("#search-results");\n' +
      '  if (results.length === 0) {\n' +
      '    container.innerHTML = "<div class=\'px-4 py-3 text-gray-500\'>未找到相关文章</div>";\n' +
      '    return;\n' +
      '  }\n' +
      '  container.innerHTML = results.map(r => `\n' +
      '    <a href="${CMSSearch.getPostUrl(r)}" class="my-result">\n' +
      '      <h4 class="font-medium">${r.title}</h4>\n' +
      '      <p class="text-sm text-gray-500">${CMSSearch.truncateExcerpt(r.excerpt)}</p>\n' +
      '    </a>\n' +
      '  `).join("");\n' +
      '});\n' +
      '</script>\n' +
      '```\n\n' +
      '=== API 路由 ===\n' +
      'GET /api/plugin/search/search?q=关键词&limit=5\n' +
      '返回: { results: SearchResult[] }'
    );
  });

  add_filter("wp_footer", (footer: string) => footer + `<script>${SEARCH_API_JS}</script>`);

  add_action("add_page", async (payload: any) => {
    if (!oramaDB) return;
    const post = payload?.post;
    if (!post?.id) return;

    try {
      if (post.status === "PUBLISHED") {
        await oramaUpsert(oramaDB, {
          id: post.id,
          title: post.title,
          content: post.content || "",
          excerpt: post.excerpt || "",
          slug: post.slug,
          categorySlug: post.category?.slug || "",
          categoryName: post.category?.name || "",
        });
      } else {
        await oramaRemove(oramaDB, post.id);
      }
    } catch (err) {
      console.error("[Search] 索引同步失败:", err);
    }
  });
}