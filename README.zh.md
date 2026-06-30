[中文](README.zh.md) · [English](README.en.md) · [日本語](README.ja.md)

---

# AI CMS — 辰星科技 AI 建站工具

基于 **Next.js 16 + Prisma + SQLite** 的全栈内容管理系统，深度集成 AI 能力和 **MCP 协议**，让 AI Agent 可以直接管理站点内容、生成页面、发布文章。

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 16.2 (App Router) · React 19.2 |
| 语言 | TypeScript (strict) |
| 数据库 | Prisma 6.19 + SQLite |
| 认证 | JWT (jose) · httpOnly Cookie + Bearer API Token |
| 样式 | Tailwind CSS 4 + @tailwindcss/typography |
| 编辑器 | CodeMirror 6 (HTML 源码编辑) |
| 校验 | Zod 4 |
| AI | OpenAI 兼容 API · SSE 流式 · Vision 多模态 |
| AI 集成 | MCP Server (`@modelcontextprotocol/sdk`) |

## 快速开始

```bash
# 初始化环境变量 (务必修改 JWT_SECRET)
cp env.example .env

# 安装依赖
npm install

# 初始化数据库
npx prisma db push
npm run db:seed

# 启动开发服务器
npm run dev
# → 前台: http://localhost:3000
# → 后台: http://localhost:3000/admin
```

默认管理员账号：`admin` / `admin123`

### 环境变量

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-me-in-production"
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
```

## 项目结构

```
cms/
├── prisma/                  # 数据模型 & 种子数据
│   ├── schema.prisma        # 12 个模型定义
│   └── seed.ts              # 初始管理员 & 示例数据
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 首页 (SSR 动态渲染)
│   │   ├── [categorySlug]/         # 分类页 & 文章详情
│   │   ├── (admin)/admin/          # 管理后台
│   │   └── api/                    # REST API (20+ 端点)
│   ├── components/          # 共享 UI 组件
│   ├── generated/prisma/    # Prisma Client (自动生成)
│   └── lib/
│       ├── auth.ts          # JWT 认证
│       ├── hooks.ts         # WordPress 风格 Hook 系统
│       ├── page-renderer.ts # 页面渲染引擎
│       ├── placeholder-registry.ts # 占位符注册表
│       ├── plugin-loader.ts # 插件动态加载器
│       ├── prisma.ts        # Prisma 单例
│       └── plugins/         # 内置插件
│           ├── ecommerce/   # 电商插件
│           ├── analytics/   # 数据统计
│           ├── contact-form/# 联系表单
│           └── search/      # 搜索
├── mcp/                     # MCP Server (AI Agent 接入)
│   └── server.js            # 30+ 工具定义
├── doc/                     # 项目文档
├── skills/                  # AI Skill 定义
└── public/uploads/          # 文件上传目录
```

## 核心能力

### 1. 内容管理

- **分类 / 文章 / 标签**：完整 CRUD + 批量管理
- **自定义页面**：独立 Page 模型，支持 HTML 占位符 + AI 生成
- **版本控制**：文章/页面的编辑历史，支持回滚
- **国际化**：多语言翻译管理，多态关联
- **媒体库**：文件上传与管理

### 2. 页面渲染引擎

首页通过 Page + 占位符系统动态渲染，支持：

- **数据绑定**：`{post.title}` / `{post.content}` 等模板语法
- **插件占位符**：`data-cms-plugin="ecommerce:productGrid"` 由插件注入内容
- **Hook 系统**：WordPress 风格的 `add_action` / `add_filter` / `apply_filters`

插件渲染流程：

```
before_render_page → filter_page_content → 静态绑定替换
→ register_placeholders → 插件占位符渲染
→ wp_head / wp_footer → filter_rendered_html
```

### 3. 插件系统

插件放在 `src/lib/plugins/<slug>/`，暴露 `index.ts` 即可自动发现加载。核心 API：

| API | 说明 |
|-----|------|
| `add_action(hook, callback)` | 注册动作钩子 |
| `add_filter(hook, callback)` | 注册过滤器钩子 |
| `register_placeholder(name, renderer)` | 注册占位符渲染函数 |
| `registerPluginApiRoute('/', router)` | 注册 `/api/plugin/<slug>/*` 路由 |

内置钩子：

| Hook | 类型 | 用途 |
|------|------|------|
| `register_placeholders` | Action | 注册占位符 |
| `wp_head` | Filter | 注入 `<head>` 内容 |
| `wp_footer` | Filter | 注入底部脚本 |
| `admin_menu` | Filter | 后台菜单注入 |
| `admin_page_<slug>` | Filter | 插件后台页面 |
| `filter_page_content` | Filter | 页面内容预处理 |
| `filter_rendered_html` | Filter | 全局 HTML 后处理 |

### 4. AI 能力

- **AI 生成页面**：输入描述，流式生成 HTML 页面
- **AI 生成帖子**：输入主题，自动生成标题 + 正文
- **Vision 多模态**：上传设计稿，AI 识别并生成对应页面
- **AI 生成 Style**：根据描述生成 Markdown 样式定义

### 5. MCP 协议 (AI Agent 直接操控)

提供 30+ 个 MCP 工具，AI Agent 通过标准 MCP 协议直接操控 CMS：

```bash
# 启动 MCP Server
cd mcp && node server.js
```

部分工具：

| 工具 | 说明 |
|------|------|
| `cms_site_info` | 获取站点概览 |
| `cms_list_posts` | 文章列表 |
| `cms_create_post` | 创建文章 |
| `cms_update_post` | 更新文章 |
| `cms_list_categories` | 分类列表 |
| `cms_create_page_html` | AI 生成页面 |
| `cms_deploy_page` | 部署/更新页面 |
| `cms_upload_media` | 上传媒体文件 |
| `cms_manage_plugin` | 插件管理 |
| … | (共 30+ 工具) |

环境变量：

```env
CMS_API_URL=http://localhost:3000/
CMS_API_TOKEN=<用户的 API Token>
```

### 6. 电商插件 (E-Commerce)

内置插件，提供完整电商能力：

- 商品管理 (CRUD + 批量上下架 + 属性筛选)
- 商品占位符 (商品卡片 / 网格 / 购买按钮 / 筛选器)
- 售后系统 (提交 → 费用计算 → 支付 → 跟踪)
- 支付适配器 (微信支付 stub，可扩展)
- `add_page` 钩子：创建帖子时自动入库商品

### 7. 权限系统

三级角色：`SUPER_ADMIN` > `ADMIN` > `EDITOR`

支持两种认证方式：
- **Cookie**：后台页面使用 (httpOnly, SameSite=Lax)
- **API Token**：MCP Server / 外部调用使用

## API 端点

| 模块 | 端点 |
|------|------|
| 认证 | `POST /api/auth/token` · `POST /api/auth/logout` |
| 分类 | `GET/POST /api/categories` · `GET/PATCH/DELETE /api/categories/[id]` |
| 文章 | `GET/POST /api/posts` · `GET/PATCH/DELETE /api/posts/[id]` |
| 标签 | `GET/POST /api/tags` · `GET/PATCH/DELETE /api/tags/[id]` |
| 页面 | `GET/POST /api/pages` · `GET/PATCH/DELETE /api/pages/[id]` |
| 媒体 | `GET/POST /api/media` · `DELETE /api/media/[id]` |
| 首页 | `GET/PATCH /api/homepage` |
| 设置 | `GET/PATCH /api/settings` · `/api/settings/llm` · `/api/settings/site` |
| 搜索 | `GET /api/search?q=` |
| 版本 | `GET /api/versions/[type]/[id]` · POST 回滚 |
| 站点 | `GET /api/site` (站点状态概览) |
| 插件 | `/api/plugins/*` · `/api/plugin/<slug>/*` |
| Skill | `GET /api/skills` · `/api/schema/placeholders` |

## 数据库

默认使用 SQLite (`prisma/dev.db`)，可切换至 MySQL/PostgreSQL：

```bash
npx prisma db push     # 同步 Schema 到数据库
npx prisma studio      # 可视化数据浏览
npm run db:seed        # 重新初始化种子数据
```

12 个数据模型：User · Category · Post · Tag · PostTag · Page · PageImage · Media · Style · Plugin · Setting · ContentVersion · Translation · SiteLanguage

## 部署

```bash
npm run build   # 生产构建
npm start       # 启动生产服务 (默认 :3000)
```

生产环境务必修改 `JWT_SECRET` 并配置 LLM API Key。

## 文档

详细文档见 `doc/` 目录：

- `项目总览：AI CMS（辰星科技 AI 建站工具）.md` — 架构与数据模型
- `插件功能详解.md` — Hook 系统、占位符、插件开发
- `AI建站工具` — AI 生成页面使用指南
