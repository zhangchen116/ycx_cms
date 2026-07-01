## 项目总览：AI CMS（辰星科技 AI 建站工具）

这是一个基于 **Next.js 16 + Prisma + SQLite** 构建的全栈内容管理系统（CMS），核心特色是 **深度集成 AI 能力** 和 **MCP（Model Context Protocol）协议**，让 AI Agent 能够直接管理站点内容、生成页面、发布文章。

---

## 技术栈

| 层面       | 技术选型                                           |
| ---------- | -------------------------------------------------- |
| 框架       | Next.js 16.2.7（App Router）、React 19.2           |
| 语言       | TypeScript（strict 模式）                          |
| 数据库     | Prisma 6.19 + SQLite（开发环境，生产可切 MySQL）   |
| 认证       | JWT（jose 库）+ httpOnly Cookie + Bearer API Token |
| 样式       | Tailwind CSS 4 + @tailwindcss/typography           |
| 代码编辑器 | CodeMirror 6（用于页面 HTML 源码编辑）             |
| 校验       | Zod 4                                              |
| AI         | OpenAI 兼容 API（SSE 流式返回）、Vision 多模态     |
| AI 集成    | MCP Server（`@modelcontextprotocol/sdk`）          |
| 其他       | adm-zip（插件打包）、bcryptjs（密码哈希）          |

---

## 数据模型（12 个核心模型）

```13:22:cms/prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  role      Role     @default(EDITOR)
  apiToken  String?  @unique
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

数据模型覆盖了 CMS 的完整能力域：

- **用户与权限**：`User`（三级角色 `SUPER_ADMIN` / `ADMIN` / `EDITOR`）
- **内容**：`Category`（分类）→ `Post`（文章）→ `PostImage`（配图）；`Page`（自定义页面）→ `PageImage`
- **标签**：`Tag` + `PostTag`（多对多关联表，带 `postCount` 冗余计数）
- **版本控制**：`ContentVersion`（多态设计，`contentType` 字段区分 post/page）
- **国际化**：`Translation`（多态翻译）+ `SiteLanguage`（站点语言配置）
- **样式系统**：`Style`（Markdown 定义样式，可编译为 JSON，支持内置样式）
- **插件系统**：`Plugin`（数据库管理开关、配置、hooks）
- **站点设置**：`Setting`（KV 结构，如 `site_title`、`homepage_page_id`、LLM 配置等）
- **媒体**：`Media`（文件上传管理）

---

## 项目架构

### 1. 前台（SSR 服务端渲染）

```
/                          → 首页（动态渲染 Page.content，或兜底默认布局）
/[categorySlug]            → 分类页（该分类文章列表）
/[categorySlug]/[postSlug] → 文章详情页
```

首页的核心逻辑在 `src/app/page.tsx`：读取 `Setting.homepage_page_id` 找到关联的 `Page`，如果有 `content`（含占位符的 HTML），则调用 `renderPageContent` 动态渲染。

### 2. 管理后台（CSR 客户端渲染）

后台在 `src/app/(admin)/admin/` 下，采用左侧导航 + 右侧内容的布局（见 `layout.tsx`）：

```13:21:cms/src/app/(admin)/admin/layout.tsx
const NAV = [
  { href: "/admin", label: "仪表盘" },
  { href: "/admin/homepage", label: "首页" },
  { href: "/admin/categories", label: "分类" },
  { href: "/admin/posts", label: "帖子" },
  { href: "/admin/tags", label: "标签" },
  { href: "/admin/skills", label: "技能管理" },
  { href: "/admin/settings", label: "设置" },
];
```

后台页面包括：仪表盘、首页编辑、分类管理、帖子管理（含 AI 生成）、标签管理、技能管理、设置（LLM 配置 + 插件开关）、用户管理（仅 SUPER_ADMIN）。插件还可以动态注入后台菜单项。

### 3. API 路由（约 30 条）

API 在 `src/app/api/` 下，覆盖：

- **认证**：`/api/auth`（登录/会话）、`/api/auth/logout`、`/api/auth/token`（API Token 生成）
- **内容 CRUD**：`/api/posts`、`/api/categories`、`/api/pages`、`/api/tags`、`/api/users`、`/api/media`
- **AI 生成**：`/api/posts/ai-generate`、`/api/pages/ai-generate`、`/api/homepage/ai-generate`（均为 SSE 流式）
- **版本控制**：`/api/versions/[contentType]/[contentId]`（列表 + 回滚）
- **国际化**：`/api/i18n/config`、`/api/i18n/translations`
- **插件**：`/api/plugins`（开关）、`/api/plugins/upload`（上传 zip 安装）
- **Schema**：`/api/schema/page`（页面编辑规范）、`/api/schema/placeholders`（动态获取已启用插件的占位符规则，供 AI Agent 在生成页面 HTML 前调用）
- **站点**：`/api/site`、`/api/admin/stats`、`/api/admin/menu`、`/api/admin/plugin-page/[slug]`

---

## 核心机制详解

### A. 认证系统（双模式）

`src/lib/auth.ts` 支持两种认证方式：

1. **JWT Cookie**：用于后台浏览器访问，7 天有效期
2. **Bearer API Token**：用于 MCP Server 和外部 API 调用，存储在 `User.apiToken` 字段

```41:55:cms/src/lib/auth.ts
export async function getSessionFromRequest(
  req: Request
): Promise<SessionPayload | null> {
  // Try Bearer token first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiToken = authHeader.slice(7);
    const user = await prisma.user.findUnique({
      where: { apiToken },
      select: { id: true, username: true, role: true },
    });
    if (user) {
      return { userId: user.id, username: user.username, role: user.role };
    }
  }
  // Fallback to cookie
  ...
```

### B. 权限系统

`src/lib/permission.ts` 集中定义权限矩阵：

```8:25:cms/src/lib/permission.ts
const PERMISSIONS: Record<string, Role[]> = {
  "users:create": ["SUPER_ADMIN"],
  "users:delete": ["SUPER_ADMIN"],
  "categories:mutate": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "pages:mutate": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "styles:mutate": ["SUPER_ADMIN", "ADMIN"],
  "settings:mutate": ["SUPER_ADMIN", "ADMIN"],
  "versions:rollback": ["SUPER_ADMIN", "ADMIN"],
  "plugins:mutate": ["SUPER_ADMIN", "ADMIN"],
  ...
```

三级权限：EDITOR（内容编辑）→ ADMIN（系统配置）→ SUPER_ADMIN（用户管理）。

### C. 页面渲染引擎（最核心）

这是整个项目的精华所在。`src/lib/page-renderer.ts` 实现了一个 **基于 HTML 占位符的模板渲染系统**，灵感类似 WordPress 的短代码机制。配套的 `src/lib/placeholder-registry.ts`（占位符注册表）和 `src/lib/placeholder-docs.ts`（占位符文档生成器）负责插件占位符的动态注册与使用说明输出，支持 AI Agent 通过 `/api/schema/placeholders` 实时获取当前站点启用的插件占位符规则。

**渲染流程：**

```349:391:cms/src/lib/page-renderer.ts
export async function renderPageContent(
  html: string,
  context?: Partial<RenderContext>,
): Promise<string> {
  if (!html) return "";
  await loadPlugins();
  const siteSettings = await getSiteSettings();
  const ctx: RenderContext = { siteSettings, ...context };

  await do_action("before_render_page", ctx, html);
  let result = await apply_filters("filter_page_content", extractBodyContent(html), ctx);

  result = renderStaticBinds(result, ctx);       // ① 静态绑定 site.xxx / page.title
  result = await renderCategories(result, ctx.prependHome);  // ② 分类列表
  result = await renderPosts(result);             // ③ 文章列表
  result = await renderPlaceholders(result, siteSettings, ctx.page);  // ④ 插件占位符
  result = await apply_filters("filter_rendered_html", result, ctx);

  // 注入 wp_head / wp_footer
  const head = await apply_filters("wp_head", "", ctx);
  const footer = await apply_filters("wp_footer", "", ctx);
  result = head + result + footer;
  ...
}
```

**支持的占位符：**

| 占位符                                               | 作用             | 示例                                         |
| ---------------------------------------------------- | ---------------- | -------------------------------------------- |
| `data-cms-bind="site.title"`                         | 静态绑定站点设置 | `<title data-cms-bind="site.title">`         |
| `data-cms-bind="page.title"`                         | 绑定页面标题     | `<h1 data-cms-bind="page.title">`            |
| `data-cms-posts data-category="tech" data-limit="5"` | 文章列表循环     | 内部模板用 `post.title` / `post.link` 等     |
| `data-cms-categories`                                | 分类列表循环     | 内部模板用 `category.name` / `category.link` |
| `data-cms-plugin="search"`                           | 插件占位符       | 渲染为插件输出                               |

渲染器会通过栈式深度匹配找到容器标签的闭合位置，提取内部模板，查询数据库，对每条数据重复渲染模板并替换占位符。

### D. 插件系统（WordPress 风格）

项目实现了一套轻量级的 **Hook 机制**（`src/lib/hooks.ts`），类似 WordPress 的 `add_action` / `add_filter`：

- **Action**（`do_action`）：无返回值的事件钩子，如 `before_render_page`、`register_placeholders`
- **Filter**（`apply_filters`）：链式传递返回值的过滤器，如 `filter_page_content`、`wp_head`、`wp_footer`

插件通过 `src/lib/plugin-loader.ts` 动态加载，从数据库读取已启用插件，动态 import 对应模块：

```7:27:cms/src/lib/plugin-loader.ts
export async function loadPlugins() {
  if (loaded) return;
  loaded = true;
  const plugins = await prisma.plugin.findMany({ where: { enabled: true } });
  for (const p of plugins) {
    const config = (p.config as Record<string, unknown>) || {};
    try {
      const mod = await import(`@/lib/plugins/${p.slug}`);
      if (typeof mod.default === "function") {
        await mod.default(config);
      }
    } catch (err) {
      console.error(`[Plugin] 加载 ${p.slug} 失败:`, err);
    }
  }
  await do_action("register_placeholders");
}
```

内置 3 个插件：

- **search**（`src/lib/plugins/search/`）：站内搜索框，注册占位符 + 注入前端 JS
- **contact-form**：联系表单
- **analytics**：统计分析

插件通过 `register_placeholder` 注册渲染函数，页面 HTML 中用 `<div data-cms-plugin="search">` 嵌入。还支持上传 zip 包安装新插件。

### E. AI 生成能力

三个 AI 生成端点均采用 **SSE（Server-Sent Events）流式返回**，兼容 OpenAI API 格式：

以文章生成为例（`src/app/api/posts/ai-generate/route.ts`）：

1. 接收 `categoryId`、`prompt`、`imageUrls`（可选配图）
2. 构造 system prompt，要求输出 JSON（title/content/excerpt/tags）
3. 支持多模态：配图以 `image_url` 格式传入（Vision 能力）
4. 调用 LLM API，解析返回结果
5. 自动生成 slug，创建草稿文章，标记 `aiGenerated: true`
6. 通过 SSE 事件推送进度：`thinking` → `generating` → `done` / `error`

页面生成同理，还会结合分类的 `Style`（样式模板）来生成符合设计规范的 HTML。

### F. Skills 系统（AI 技能管理）

`src/lib/skills.ts` 实现了一套 **AI 技能（Skill）管理系统**，存储在 `data/skills/` 目录下。每个技能是一个包含 `SKILL.md`（带 frontmatter）的目录。

支持的操作：

- `listSkills()`：列出所有技能
- `getSkill(name)`：读取技能内容
- `installSkill(gitUrl)`：从 Git 仓库克隆安装技能
- `createSkill()` / `updateSkill()`：创建/编辑技能
- `removeSkill()`：删除技能

`data/skills/` 下已有 13 个预置技能，涵盖品牌设计、前端风格、图像生成、UI 风格等领域（如 `brandkit`、`minimalist-ui`、`image-to-code`、`industrial-brutalist-ui` 等）。这些技能可以作为 AI Agent 生成内容时的风格指导。

**架构演进：插件占位符与 SKILL.md 解耦（v2）**

早期 SKILL.md 下载时会内联插件占位符文档（`/api/skills/download` 中的 `generatePluginSection()`），但这导致每次增减插件都必须重新分发 SKILL.md。新架构将插件占位符独立为动态接口 `/api/schema/placeholders`，AI Agent 在生成页面 HTML 前单独调用该接口获取当前启用的插件占位符规则。SKILL.md 只保留站点基础配置和 CMS 工作流说明，不再包含插件相关内容。

---

## MCP Server（AI Agent 接口）

`mcp/server.js` 是独立运行的 MCP Server，让 AI Agent（如 Claude）能通过标准 MCP 协议管理 CMS：

```45:66:cms/mcp/server.js
const TOOLS = {
  cms_site_info: { ... },        // 站点概览
  cms_list_categories: { ... },   // 列出分类
  cms_list_posts: { ... },        // 列出/搜索文章
  cms_get_post: { ... },          // 获取文章详情
  cms_create_post: { ... },       // 创建文章
  cms_update_post: { ... },       // 更新文章
  cms_list_tags: { ... },         // 列出标签
  cms_create_tag: { ... },        // 创建标签
  cms_get_homepage: { ... },      // 获取首页
  cms_upload_media: { ... },      // 上传图片
  cms_get_page_schema: { ... },          // 获取页面 Schema（关键！）
  cms_get_placeholder_rules: { ... },    // 动态获取插件占位符规则
  cms_upload_page_html: { ... },         // 上传页面 HTML
  cms_render_page: { ... },              // 预览渲染结果
};
```

工作流程：AI Agent 依次调用 `cms_get_page_schema`（了解基础占位符规范）和 `cms_get_placeholder_rules`（获取当前启用插件的动态占位符），生成 HTML 后通过 `cms_upload_page_html` 上传，再用 `cms_render_page` 预览效果。MCP Server 通过 `CMS_API_TOKEN` 环境变量以 Bearer Token 方式调用 CMS API。

---

## 其他特性

- **请求日志**：`src/middleware.ts` 中间件记录所有请求到临时目录的日志文件
- **API 日志**：`src/lib/api-logger.ts` 提供高阶函数包装 API 路由
- **版本控制**：内容每次修改保存版本快照，支持回滚
- **国际化**：多语言翻译管理（多态关联 post/page）
- **CodeMirror 编辑器**：`src/components/CodeMirrorEditor.tsx` 提供页面 HTML 源码编辑
- **标签选择器**：`src/components/TagSelector.tsx` 文章编辑时的标签选择组件

---

## 启动方式

```bash
cd /Users/yock/workspace/GitHub/ycx_web/cms
npm run dev
# 前台: http://localhost:3000
# 后台: http://localhost:3000/admin/login
# 默认账号: admin / admin123
```

数据库脚本：`npm run db:generate`（生成 Prisma Client）、`npm run db:push`（同步 Schema）、`npm run db:seed`（初始化数据）、`npm run db:studio`（可视化数据库管理）。

---

## 项目定位总结

这不是一个普通的 CMS，而是一个 **AI-Native 的建站平台**，核心设计理念是：

1. **AI 可编程**：通过 MCP 协议 + API Token + Schema 自描述 + 动态占位符规则，让 AI Agent 能自主管理站点
2. **模板即数据**：页面 HTML 不是静态的，而是含占位符的动态模板，AI 只需生成符合 Schema 的 HTML
3. **插件可扩展**：WordPress 风格的 Hook 机制，插件可注入前端组件、后台菜单、渲染逻辑
4. **技能驱动**：Skills 系统为 AI 提供风格指导，让生成的内容符合品牌和设计规范

这个项目的目标用户是想要用 AI 快速建站和持续生产内容的场景，管理员可以用自然语言指挥 AI 生成页面、写文章、管理分类，而 AI 通过 MCP 接口完成全流程操作。