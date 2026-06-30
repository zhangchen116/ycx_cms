// search 插件 — 站内全文搜索组件（前端占位符 + API 搜索）
import { add_action, add_filter } from "@/lib/hooks";
import { register_placeholder } from "@/lib/placeholder-registry";

const SEARCH_JS = /* javascript */ `
(function() {
  const containers = document.querySelectorAll('.cms-plugin-search');
  containers.forEach(function(container) {
    const input = container.querySelector('.search-input');
    const results = container.querySelector('.search-results');
    const minChars = parseInt(container.dataset.minChars || '2');
    const maxResults = parseInt(container.dataset.maxResults || '5');
    let timer = null;

    function hideResults() {
      results.classList.add('hidden');
    }

    function showResults() {
      if (results.children.length > 0) {
        results.classList.remove('hidden');
      }
    }

    function renderResults(items) {
      if (!items.length) {
        results.innerHTML = '<div class="px-4 py-3 text-sm text-gray-400">未找到相关文章</div>';
        showResults();
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
      showResults();
    }

    input.addEventListener('input', function() {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < minChars) { hideResults(); return; }
      timer = setTimeout(function() {
        fetch('/api/search?q=' + encodeURIComponent(q) + '&limit=' + maxResults)
          .then(function(r) { return r.json(); })
          .then(function(data) { renderResults(data.results || []); })
          .catch(function() { hideResults(); });
      }, 300);
    });

    input.addEventListener('blur', function() {
      setTimeout(hideResults, 150);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { hideResults(); input.blur(); }
    });

    document.addEventListener('click', function(e) {
      if (!container.contains(e.target)) hideResults();
    });
  });
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
  const resultsBg = theme === "dark"
    ? "bg-gray-800 border-gray-600"
    : "bg-white border-gray-200";
  const iconColor = theme === "dark" ? "text-gray-400" : "text-gray-400";

  return `
<div class="cms-plugin cms-plugin-search relative max-w-lg my-4"
     data-min-chars="${minChars}" data-max-results="${maxResults}">
  <div class="search-input-wrapper relative">
    <input type="text"
           class="search-input w-full border rounded-lg px-4 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${inputBorder}"
           placeholder="${placeholder}" />
    <svg class="absolute left-3 top-2.5 w-4 h-4 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
    </svg>
  </div>
  <div class="search-results hidden absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-80 overflow-y-auto ${resultsBg}"></div>
</div>`;
}

export default function register(config: Record<string, unknown>) {
  // ① 注册占位符
  add_action("register_placeholders", () => {
    register_placeholder("search", renderSearch, "search",
      '在页面 HTML 中插入站内全文搜索框。支持通过 `data-cms-config` 配置：\n\n' +
      '```html\n' +
      '<div data-cms-plugin="search"></div>\n\n' +
      '<!-- 自定义配置 -->\n' +
      '<div data-cms-plugin="search" data-cms-config=\'{"placeholder":"输入关键词...","theme":"dark","minChars":1,"maxResults":8}\'></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `placeholder` | string | `"搜索文章..."` | 输入框占位文字 |\n' +
      '| `minChars` | number | `2` | 触发搜索的最小字符数 |\n' +
      '| `maxResults` | number | `5` | 最大结果数 |\n' +
      '| `theme` | `"light"` \\| `"dark"` | `"light"` | 搜索框颜色主题 |'
    );
  });

  // ② 注入前端搜索脚本（JS 自带 .cms-plugin-search 空转保护）
  add_filter("wp_footer", (footer: string) => {
    return footer + `<script>${SEARCH_JS}</script>`;
  });
}
