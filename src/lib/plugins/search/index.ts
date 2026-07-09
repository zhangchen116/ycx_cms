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

// ──── 前端占位符渲染 ────

const SEARCH_JS = /* javascript */ `
(function() {
  function init(container) {
    if (container.hasAttribute('data-cms-init')) return;
    container.setAttribute('data-cms-init', '');

    var input = container.querySelector('.search-input');
    var btn = container.querySelector('.search-btn');
    var results = container.querySelector('.search-results');
    if (!input || !btn || !results) return;

    var minChars = parseInt(container.dataset.minChars || '2');
    var maxResults = parseInt(container.dataset.maxResults || '5');

    function hide() { results.classList.add('hidden'); }
    function show() { if (results.children.length) results.classList.remove('hidden'); }

    function render(items) {
      if (!items.length) {
        results.innerHTML = '<div class="px-4 py-3 text-sm text-gray-400">未找到相关文章</div>';
        show();
        return;
      }
      results.innerHTML = items.map(function(item) {
        var href = '/' + (item.category?.slug || '') + '/' + item.slug;
        var excerpt = item.excerpt ? item.excerpt.replace(/<[^>]*>/g, '').slice(0, 60) + '...' : '';
        return '<a href="' + href + '" class="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition">' +
          '<div class="text-sm font-medium text-gray-800">' + item.title + '</div>' +
          (excerpt ? '<div class="text-xs text-gray-400 mt-0.5">' + excerpt + '</div>' : '') +
        '</a>';
      }).join('');
      show();
    }

    function doSearch() {
      var q = input.value.trim();
      if (q.length < minChars) { hide(); return; }
      fetch('/api/plugin/search/search?q=' + encodeURIComponent(q) + '&limit=' + maxResults)
        .then(function(r) { return r.json(); })
        .then(function(data) { render(data.results || []); })
        .catch(function() { hide(); });
    }

    btn.addEventListener('click', doSearch);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { doSearch(); }
      if (e.key === 'Escape') { hide(); input.blur(); }
    });

    input.addEventListener('blur', function() { setTimeout(hide, 150); });
    document.addEventListener('click', function(e) { if (!container.contains(e.target)) hide(); });
  }

  function sweep() {
    var els = document.querySelectorAll('.cms-plugin-search:not([data-cms-init])');
    for (var i = 0; i < els.length; i++) init(els[i]);
  }

  // 首次加载
  sweep();

  // 客户端路由导航（Next.js <Link> / router.push）
  var _push = history.pushState;
  history.pushState = function() {
    _push.apply(this, arguments);
    requestAnimationFrame(function() { requestAnimationFrame(sweep); });
  };

  var _replace = history.replaceState;
  history.replaceState = function() {
    _replace.apply(this, arguments);
    requestAnimationFrame(function() { requestAnimationFrame(sweep); });
  };

  window.addEventListener('popstate', function() {
    requestAnimationFrame(function() { requestAnimationFrame(sweep); });
  });

  // MutationObserver 作为兜底
  new MutationObserver(function() { sweep(); }).observe(document.body, { childList: true, subtree: true });
})();
`;

function renderSearch(_attrs: Record<string, string>, config: Record<string, unknown>): string {
  const placeholder = (config.placeholder as string) || "搜索文章...";
  const minChars = config.minChars ?? 2;
  const maxResults = config.maxResults ?? 5;
  const theme = (config.theme as string) || "light";

  const inputBorder = theme === "dark"
    ? "border-gray-600 bg-gray-800 text-white placeholder-gray-400"
    : "border-gray-200 bg-white text-gray-800 placeholder-gray-400";
  const btnBorder = theme === "dark"
    ? "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
    : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600";
  const resultsBg = theme === "dark" ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200";

  return `
<div class="cms-plugin cms-plugin-search relative max-w-lg my-4"
     data-min-chars="${minChars}" data-max-results="${maxResults}">
  <div class="flex gap-2">
    <input type="text"
           class="search-input flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${inputBorder}"
           placeholder="${placeholder}" />
    <button class="search-btn flex-shrink-0 border rounded-lg px-3 py-2.5 text-sm transition cursor-pointer ${btnBorder}">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    </button>
  </div>
  <div class="search-results hidden absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-80 overflow-y-auto ${resultsBg}"></div>
</div>`;
}

// ──── 插件入口 ────

export default async function register(_config: Record<string, unknown>) {
  // ① 启动时构建索引
  await rebuildIndex();

  // ② 注册插件 API 路由
  registerPluginApiRoute("search", "GET", "/search", handleSearch as any);

  // ③ 注册占位符
  add_action("register_placeholders", () => {
    register_placeholder("search", renderSearch, "search",
      '站内全文搜索框（Orama 引擎，支持中文分词）。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="search"></div>\n\n' +
      '<div data-cms-plugin="search" data-cms-config=\'{"placeholder":"输入关键词...","theme":"dark","minChars":1,"maxResults":8}\'></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `placeholder` | string | `"搜索文章..."` | 占位文字 |\n' +
      '| `minChars` | number | `2` | 最少字符数 |\n' +
      '| `maxResults` | number | `5` | 最大条数 |\n' +
      '| `theme` | `"light"` \\| `"dark"` | `"light"` | 颜色主题 |'
    );
  });

  // ④ 注入前端搜索脚本
  add_filter("wp_footer", (footer: string) => footer + `<script>${SEARCH_JS}</script>`);

  // ⑤ 文章变更时增量同步索引
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
