import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ──── Default Admin ────
  const password = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password, role: "SUPER_ADMIN" },
  });
  console.log("Admin user created:", admin.username);

  // ──── Default Style ────
  await prisma.style.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "默认样式",
      slug: "default",
      isBuiltin: true,
      mdContent: `# 站点默认样式

## 排版
- 标题字体: 系统默认
- 正文字体: 系统默认
- 行距: 1.75
- 最大宽度: 768px

## 颜色
- 主色: #2563eb
- 文字色: #374151
- 背景色: #ffffff
- 链接色: #2563eb

## 布局
- 单栏居中
- 导航置顶
- 页脚简洁

## 卡片样式
- 圆角: 8px
- 阴影: 0 1px 3px rgba(0,0,0,0.1)
`,
    },
  });
  console.log("Default style created");

  // ──── Default Category ────
  const category = await prisma.category.upsert({
    where: { slug: "general" },
    update: {},
    create: {
      name: "综合",
      slug: "general",
      order: 0,
      page: {
        create: {
          title: "综合",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      },
    },
  });
  console.log("Default category created:", category.name);

  // ──── Default Plugins ────
  const plugins = [
    {
      name: "联系我们",
      slug: "contact-form",
      description: "联系我们表单，支持 data-cms-plugin 占位符",
      version: "1.0.0",
      author: "ycx",
      config: { title: "联系我们" },
      hooks: [
        { hook: "register_placeholders", type: "action" },
        { hook: "filter_page_content", type: "filter" },
      ],
    },
    {
      name: "网站统计",
      slug: "analytics",
      description: "注入统计代码到 wp_head",
      version: "1.0.0",
      author: "ycx",
      enabled: false,
      config: { provider: "ga", id: "" },
      hooks: [{ hook: "wp_head", type: "filter" }],
    },
    {
      name: "SEO 优化", slug: "seo", description: "自动生成 sitemap、meta 标签", version: "1.0.0", author: "ycx", enabled: false, config: {}, hooks: [],
    },
    {
      name: "评论系统", slug: "comments", description: "文章评论功能", version: "1.0.0", author: "ycx", enabled: false, config: {}, hooks: [],
    },
    {
      name: "搜索", slug: "search", description: "站内全文搜索", version: "1.0.0", author: "ycx", enabled: false, config: {}, hooks: [],
    },
    {
      name: "RSS 订阅", slug: "rss", description: "生成 RSS / Atom feed", version: "1.0.0", author: "ycx", enabled: false, config: {}, hooks: [],
    },
  ];

  for (const p of plugins) {
    await prisma.plugin.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
  console.log("Plugins seeded");

  // ──── LLM Settings ────
  await prisma.setting.upsert({
    where: { key: "llm.provider" },
    update: {},
    create: { key: "llm.provider", value: "openai" },
  });
  await prisma.setting.upsert({
    where: { key: "llm.model" },
    update: {},
    create: { key: "llm.model", value: "gpt-4o" },
  });

  // ──── Homepage Page ────
  let homepagePage = await prisma.page.findFirst({ where: { slug: "home" } });
  if (!homepagePage) {
    homepagePage = await prisma.page.create({
      data: {
        title: "AI CMS",
        slug: "home",
        type: "STANDALONE",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }
  await prisma.setting.upsert({
    where: { key: "homepage_page_id" },
    update: { value: homepagePage.id },
    create: { key: "homepage_page_id", value: homepagePage.id },
  });
  console.log("Homepage page created:", homepagePage.title);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
