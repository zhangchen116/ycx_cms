import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPlugins } from "@/lib/plugin-loader";
import { list_placeholders } from "@/lib/placeholder-registry";

/**
 * 页面 Schema — 告诉 AI Agent 可用的字段、占位符、数据结构
 */
export async function GET() {
  // 确保插件已加载，占位符注册表已就绪
  await loadPlugins();
  const availablePlugins = list_placeholders();

  const schema = {
    version: "1.0.0",
    description: "CMS 页面编辑 schema，用于 AI Agent 生成页面 HTML",

    // 页面可编辑字段
    fields: {
      title: { type: "string", required: true, description: "页面标题" },
      content: { type: "string", description: "HTML 内容（含占位符）" },
      status: { type: "enum", values: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    },

    // 动态占位符规范
    placeholders: {
      staticBind: {
        syntax: 'data-cms-bind="<source>.<field>"',
        description: "静态数据绑定，渲染时替换为实际值",
        examples: [
          '<h1 data-cms-bind="page.title">默认标题</h1>',
          '<span data-cms-bind="site.title"></span>',
          '<meta name="description" data-cms-bind="site.description">',
        ],
        sources: {
          "page.title": "当前页面标题",
          "site.title": "站点名称（Setting: site_title）",
          "site.description": "站点描述（Setting: site_description）",
          "site.url": "站点 URL（Setting: site_url）",
        },
      },

      postsList: {
        syntax: '<div data-cms-posts [data-category="slug"] [data-limit="N"] [data-order="asc|desc"]> ...template... </div>',
        description: "文章列表动态区域，内部模板对每篇文章重复渲染",
        attributes: {
          "data-category": "可选，按分类 slug 筛选",
          "data-limit": "可选，数量限制，默认 10",
          "data-order": "可选，排序 asc/desc，默认 desc",
        },
        templateBindings: {
          "post.title": "文章标题",
          "post.excerpt": "文章摘要",
          "post.tags": "标签",
          "post.date": "发布日期",
          "post.link": "链接（自动设 href 为 /category/slug）",
        },
        example: `
<div data-cms-posts data-category="tech" data-limit="5">
  <article class="post-item">
    <a data-cms-bind="post.link">
      <h3 data-cms-bind="post.title">文章标题</h3>
    </a>
    <p data-cms-bind="post.excerpt">摘要内容</p>
    <time data-cms-bind="post.date">2024-01-01</time>
  </article>
</div>`,
      },

      categoriesList: {
        syntax: '<div data-cms-categories> ...template... </div>',
        description: "分类列表动态区域，内部模板对每个分类重复渲染",
        templateBindings: {
          "category.name": "分类名称",
          "category.slug": "分类 slug",
          "category.postCount": "该分类下已发布文章数",
          "category.link": "链接（自动设 href 为 /slug）",
        },
        example: `
<nav data-cms-categories>
  <a data-cms-bind="category.link" class="nav-link">
    <span data-cms-bind="category.name">分类名</span>
    (<span data-cms-bind="category.postCount">0</span>)
  </a>
</nav>`,
      },
    },

    // 页面类型
    pageTypes: {
      homepage: {
        description: "首页，通过 Setting.homepage_page_id 关联 Page",
        typicalContent: ["导航栏（分类列表）", "最新文章列表", "站点介绍"],
      },
      categoryPage: {
        description: "分类子页面，通过 Category.pageId 关联 Page",
        typicalContent: ["分类标题", "该分类下的文章列表"],
      },
      customPage: {
        description: "自定义独立页面",
        typicalContent: ["自定义内容"],
      },
    },

    plugins: {
      description: "通过 data-cms-plugin 占位符嵌入插件",
      syntax: '<div data-cms-plugin="<plugin-name>"></div>',
      available:
        availablePlugins.length > 0
          ? availablePlugins
          : [{ name: "contact-form", description: "联系我们表单" }],
    },

    guidelines: [
      "生成的 HTML 应为完整文档或 body 片段（取决于使用场景）",
      "使用语义化 HTML 标签",
      "动态区域使用上述占位符标记",
      "插件使用 <div data-cms-plugin=\"name\"></div> 嵌入",
      "静态部分直接写入 HTML",
      "CSS 使用内联 style 或 Tailwind 类",
    ],
  };

  return NextResponse.json(schema);
}
