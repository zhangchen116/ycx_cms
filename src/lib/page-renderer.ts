import { prisma } from "@/lib/prisma";
import { do_action, apply_filters } from "@/lib/hooks";
import { get_placeholder_renderer } from "@/lib/placeholder-registry";
import { loadPlugins } from "@/lib/plugin-loader";

export interface RenderContext {
  page?: {
    id: string;
    title: string;
    content?: string | null;
    category?: { id: string; name: string; slug: string } | null;
  };
  siteSettings?: Record<string, string>;
  /** 在分类列表最前面插入"首页"链接（仅分类页需要） */
  prependHome?: boolean;
}

async function getSiteSettings(): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
}

/**
 * 用栈式深度匹配找到 data-cms-posts / data-cms-categories 容器对应的闭合标签内容。
 */
function findContainerMatch(
  html: string,
  attr: "data-cms-posts" | "data-cms-categories",
): { containerTag: string; openTag: string; template: string; fullMatch: string; index: number } | null {
  const openRegex = new RegExp(`<([\\w-]+)[^>]*\\b${attr}\\b[^>]*>`, "gi");
  const m = openRegex.exec(html);
  if (!m) return null;

  const tag = m[1];
  const openTag = m[0];
  const start = m.index + openTag.length;

  let depth = 1;
  const tagRegex = /<\/?(\w+)[^>]*>/g;
  tagRegex.lastIndex = start;

  let tm: RegExpExecArray | null;
  while (depth > 0 && (tm = tagRegex.exec(html))) {
    if (tm[1] === tag) {
      depth += tm[0][1] === "/" ? -1 : 1;
    }
    tagRegex.lastIndex;
  }

  if (depth !== 0) return null;

  return {
    containerTag: tag,
    openTag,
    template: html.slice(start, tm!.index),
    fullMatch: html.slice(m.index, tm!.index + tm![0].length),
    index: m.index,
  };
}

/** 剥离外层 wrapper，只保留可重复的卡片。 */
function extractCardTemplate(template: string) {
  const m = template.match(
    /^(\s*<(\w+)[^>]*>\s*)([\s\S]*?)(\s*<\/\2>\s*)$/,
  );
  if (m && /data-cms-bind/.test(m[3])) {
    return {
      wrapperPrefix: m[1],
      cardTemplate: m[3],
      wrapperSuffix: m[4],
    };
  }
  return { wrapperPrefix: "", cardTemplate: template, wrapperSuffix: "" };
}

// ====== 文章 ======

async function renderPosts(html: string): Promise<string> {
  let result = html;
  let cm: ReturnType<typeof findContainerMatch>;

  while ((cm = findContainerMatch(result, "data-cms-posts"))) {
    const { containerTag, openTag, template, fullMatch } = cm;

    const catSlug = openTag.match(/data-category=["']([^"']+)["']/)?.[1];
    const limit = parseInt(openTag.match(/data-limit=["'](\d+)["']/)?.[1] || "10");
    const order = openTag.match(/data-order=["'](\w+)["']/)?.[1] === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = { status: "PUBLISHED" };
    if (catSlug) {
      const cat = await prisma.category.findUnique({ where: { slug: catSlug } });
      if (cat) where.categoryId = cat.id;
      else continue;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { publishedAt: order },
      take: limit,
      include: {
        category: { select: { slug: true, name: true } },
        tags_rel: { include: { tag: true } },
      },
    });

    const postsForRender = posts.map((p) => ({
      title: p.title,
      excerpt: p.excerpt,
      slug: p.slug,
      category: p.category,
      tags: p.tags_rel?.map((pt) => pt.tag.name).join(",") || p.tags || null,
      publishedAt: p.publishedAt,
    }));

    const { wrapperPrefix, cardTemplate, wrapperSuffix } =
      extractCardTemplate(template);

    const wrapperIsCard = /<article\b/i.test(wrapperPrefix) || /\bpost-card\b/.test(wrapperPrefix);

    let rendered = "";
    for (const post of postsForRender) {
      const card = replacePostPlaceholders(cardTemplate, post);
      rendered += wrapperIsCard
        ? `${wrapperPrefix}${card}${wrapperSuffix}`
        : card;
    }

    const cleanOpen = openTag
      .replace(/\s*data-cms-posts\b/, "")
      .replace(/\s*data-category=["'][^"']*["']/, "")
      .replace(/\s*data-limit=["']\d+["']/, "")
      .replace(/\s*data-order=["']\w+["']/, "");

    const inner = wrapperIsCard ? rendered : `${wrapperPrefix}${rendered}${wrapperSuffix}`;
    const isEmptyTag = /^<\w+\s*>$/.test(cleanOpen);
    if (isEmptyTag) {
      result = result.replace(fullMatch, inner);
    } else {
      result = result.replace(fullMatch, `${cleanOpen}${inner}</${containerTag}>`);
    }
  }

  return result;
}

function replacePostPlaceholders(
  template: string,
  post: {
    title: string;
    excerpt: string | null;
    slug: string;
    category: { slug: string };
    tags: string | null;
    publishedAt: Date | null;
  },
): string {
  let html = template;

  html = html.replace(
    /(<[\w-][^>]*)(\s+data-cms-bind="post\.link")([^>]*>)/gi,
    (_m, tagStart, _attr, tagEnd) => {
      let open = `${tagStart}${tagEnd}`;
      const href = `/${post.category.slug}/${post.slug}`;
      if (/href\s*=/.test(open)) {
        open = open.replace(/href\s*=\s*"[^"]*"/, `href="${href}"`);
      } else {
        open = open.replace(/>$/, ` href="${href}">`);
      }
      return open;
    },
  );

  html = html.replace(
    /(<[\w-][^>]*\sdata-cms-bind="post\.(\w+)"[^>]*>)([\s\S]*?)(<\/[\w-]+>)/gi,
    (_m, openTag, field, innerText, closeTag) => {
      switch (field) {
        case "title":
          return `${openTag}${post.title}${closeTag}`;
        case "excerpt":
          return `${openTag}${post.excerpt || ""}${closeTag}`;
        case "tags":
          return `${openTag}${post.tags || ""}${closeTag}`;
        case "date":
          return `${openTag}${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-CN") : ""}${closeTag}`;
        default:
          return _m;
      }
    },
  );

  return html;
}

// ====== 分类 ======

async function renderCategories(html: string, prependHome?: boolean): Promise<string> {
  let result = html;
  let cm: ReturnType<typeof findContainerMatch>;

  while ((cm = findContainerMatch(result, "data-cms-categories"))) {
    const { containerTag, openTag, template, fullMatch } = cm;

    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
      },
    });

    const { wrapperPrefix, cardTemplate, wrapperSuffix } =
      extractCardTemplate(template);

    let rendered = "";
    if (prependHome) {
      rendered += replaceCategoryPlaceholders(cardTemplate, {
        name: "首页", slug: "", _count: { posts: 0 },
      } as any);
    }
    for (const cat of categories) {
      rendered += replaceCategoryPlaceholders(cardTemplate, cat);
    }

    const cleanOpen = openTag.replace(/\s*data-cms-categories\b/, "");
    result = result.replace(
      fullMatch,
      `${cleanOpen}${wrapperPrefix}${rendered}${wrapperSuffix}</${containerTag}>`,
    );
  }

  return result;
}

function replaceCategoryPlaceholders(
  template: string,
  category: { name: string; slug: string; _count: { posts: number } },
): string {
  let html = template;

  html = html.replace(
    /(<[\w-][^>]*)(\s+data-cms-bind="category\.link")([^>]*>)/gi,
    (_m, tagStart, _attr, tagEnd) => {
      let open = `${tagStart}${tagEnd}`;
      const href = `/${category.slug}`;
      if (/href\s*=/.test(open)) {
        open = open.replace(/href\s*=\s*"[^"]*"/, `href="${href}"`);
      } else {
        open = open.replace(/>$/, ` href="${href}">`);
      }
      return open;
    },
  );

  html = html.replace(/class="([^"]*\bicon-)\w+([^"]*)"/, (_m, prefix, suffix) => {
    const s = category.slug;
    const iconClass = s === "软件" ? "software" : s || "general";
    return `class="${prefix}${iconClass}${suffix}"`;
  });

  html = html.replace(
    /(<[\w-][^>]*\sdata-cms-bind="category\.(\w+)"[^>]*>)([\s\S]*?)(<\/[\w-]+>)/gi,
    (_m, openTag, field, innerText, closeTag) => {
      switch (field) {
        case "name":
          return `${openTag}${category.name}${closeTag}`;
        case "slug":
          return `${openTag}${category.slug}${closeTag}`;
        case "postCount": {
          const suffix = innerText.replace(/^\d+/, "");
          return `${openTag}${category._count.posts}${suffix}${closeTag}`;
        }
        default:
          return _m;
      }
    },
  );

  return html;
}

// ====== 静态绑定 ======

function renderStaticBinds(html: string, context: RenderContext): string {
  html = html.replaceAll(/data-cms-bind="site\.([\w.]+)"/g, (_m, key) => {
    const val = context.siteSettings?.[key] ?? "";
    return `data-cms-bind-rendered="${val}"`;
  });

  html = html.replaceAll(/data-cms-bind="page\.title"/g, () => {
    const val = context.page?.title ?? "";
    return `data-cms-bind-rendered="${val}"`;
  });

  return html;
}

// ====== 插件占位符 ======

async function renderPlaceholders(
  html: string,
  siteSettings: Record<string, string>,
  page?: RenderContext["page"],
): Promise<string> {
  let result = html;
  const regex = /<(\w+)([^>]*\sdata-cms-plugin="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi;

  for (const m of result.matchAll(regex)) {
    const [fullMatch, _tag, allAttrs, pluginName] = m;
    const entry = await get_placeholder_renderer(pluginName);
    if (!entry) continue;

    const attrs: Record<string, string> = {};
    for (const attrM of allAttrs.matchAll(/data-([\w-]+)="([^"]*)"/g)) {
      attrs[attrM[1]] = attrM[2];
    }

    let pageConfig: Record<string, unknown> = {};
    if (attrs["cms-config"]) {
      try { pageConfig = JSON.parse(attrs["cms-config"]); } catch { /* ignore */ }
    }

    const mergedConfig = { ...entry.config, ...pageConfig };
    const rendered = await entry.render(attrs, mergedConfig, { siteSettings, page });
    result = result.replace(fullMatch, rendered);
  }

  return result;
}

// ====== 入口 ======

/** 从完整 HTML 文档中抽出 <style> + <body> 内容 */
function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return html;

  const parts: string[] = [];
  const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  if (headMatch) {
    for (const m of headMatch[1].matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)) {
      parts.push(m[0]);
    }
  }
  parts.push(bodyMatch[1]);
  return parts.join("\n");
}

export async function renderPageContent(
  html: string,
  context?: Partial<RenderContext>,
): Promise<string> {
  if (!html) return "";

  // 加载插件
  await loadPlugins();

  const siteSettings = await getSiteSettings();
  const ctx: RenderContext = { siteSettings, ...context };

  await do_action("before_render_page", ctx, html);

  let result = await apply_filters("filter_page_content", extractBodyContent(html), ctx);

  result = renderStaticBinds(result, ctx);
  await do_action("after_static_binds", result, ctx);

  result = await renderCategories(result, ctx.prependHome);
  await do_action("after_render_categories", result, ctx);

  result = await renderPosts(result);
  await do_action("after_render_posts", result, ctx);

  // 渲染插件占位符
  result = await renderPlaceholders(result, siteSettings, ctx.page);
  await do_action("after_placeholders", result, ctx);

  result = await apply_filters("filter_rendered_html", result, ctx);

  // 注入 wp_head / wp_footer
  const head = await apply_filters("wp_head", "", ctx);
  const footer = await apply_filters("wp_footer", "", ctx);
  result = head + result + footer;

  result = result.replaceAll(/\s+data-cms-bind-rendered="[^"]*"/g, "");
  result = result.replaceAll(
    /\s+data-cms-bind="(post|category|site|page)\.[^"]*"/g,
    "",
  );
  return result;
}
