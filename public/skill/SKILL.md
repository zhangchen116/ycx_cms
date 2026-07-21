---
name: ycx-cms
description: AI 建站工具 CMS 管理。通过 MCP 协议远程管理站点内容：更新首页、更新分类页面、发布/管理帖子、上传图片。适用于已部署 ycx_web CMS 的项目。
metadata:
  openclaw:
    emoji: "🏗️"
---

# YCX CMS Manager

通过 MCP 工具管理 ycx_web AI 建站工具的站点内容。支持三种核心操作：
- **更新首页** — 生成含动态占位符的 HTML 模板，上传到首页
- **更新分类页面** — 为指定分类生成页面模板，上传到对应页面
- **发布帖子** — 创建/更新博客帖子

## 前置条件

- CMS 已部署并运行（默认 `http://localhost:3000`）
- 已生成 API Token（CMS 管理后台 → 用户管理 → 生成 Token）

## MCP 连接配置

在 OpenClaw 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "cms": {
      "command": "node",
      "args": ["<包路径>/mcp/server.js"],
      "env": {
        "CMS_API_URL": "http://localhost:3000",
        "CMS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

> 将 `<包路径>` 替换为 `当前文件路径。
> 将 `CMS_API_TOKEN` 替换为 CMS 后台生成的 Token。

## 核心概念：HTML 占位符模板

CMS 页面支持**动态占位符 HTML**——上传的 HTML 中含有特殊 `data-cms-*` 属性，服务器在渲染时自动替换为实际数据。这样 AI 只需生成一次模板，页面内容会随数据库变化自动更新。



## 可用工具

### cms_get_page_schema — 获取页面 Schema
无需参数。返回完整的占位符规范、可用字段、示例 HTML。**生成页面 HTML 前务必先调用此工具**。

### cms_get_placeholder_rules — 获取占位符规则
无需参数。返回所有已启用插件的占位符使用规则（纯文本 Markdown）。

### cms_site_info — 站点概览
无需参数。返回首页标题、分类及帖子数、最近 10 篇。

### cms_list_categories — 分类列表
无需参数。列出所有分类的 ID、名称、slug、帖子数。

### cms_list_tags — 标签列表
可选参数：`q`（搜索）、`orderBy`（`name`/`postCount`）。返回所有标签及引用计数。

### cms_create_tag — 创建标签
必填：`name`。已存在则幂等返回。

### cms_list_posts — 帖子搜索
可选参数：`categoryId`、`status`（`DRAFT`/`PUBLISHED`）、`search`、`tagId`、`page`。

### cms_get_post — 帖子详情
必填：`id`。返回完整 HTML 内容、标题、标签等。

### cms_create_post — 创建帖子
必填：`title`、`content`（HTML）、`categoryId`。
可选：`slug`、`tagIds`（标签 ID 列表）、`excerpt`、`imageUrl`、`status`。

### cms_update_post — 更新帖子
必填：`id`。可选更新：`title`、`content`、`tagIds`、`excerpt`、`imageUrl`、`status`。

### cms_get_homepage — 获取首页
无需参数。返回首页标题、描述、当前 HTML 内容。

### cms_upload_page_html — 上传页面 HTML
必填：`pageId`、`filePath`（本地 HTML 文件绝对路径）。
可选：`title`（同时更新页面标题）。
将含 `data-cms-*` 占位符的 HTML 文件上传到指定页面。

### cms_render_page — 预览页面渲染结果
必填：`pageId`。返回占位符被替换后的完整 HTML，用于验证模板是否正确。

### cms_upload_media — 上传图片
必填：`filePath`（本地图片绝对路径）。返回图片 URL。

## 典型工作流

### 配图发布

```
1. cms_upload_media { filePath: "/path/to/img.png" } → 拿到图片 URL
2. 图片 URL 在生成 HTML 时用     → 发布带图的首页、分类页面、帖子
```

### 工作流一：更新首页

```
1. cms_get_page_schema              → 了解占位符和示例
2. cms_get_placeholder_rules				→ 获取插件占位符使用规则
3. 生成 HTML 模板（含 data-cms-*）   → AI 根据站点需求编写模板
4. cms_upload_media (可选)           → 上传配图，获取 URL 嵌入模板
5. cms_upload_page_html {            → 上传 HTML 到首页
     pageId: "<首页Page ID>",
     filePath: "/path/to/homepage.html",
     title: "首页"
   }
6. cms_render_page { pageId: "..." } → 预览渲染效果，确认无误
```

> 首页 Page ID 可通过 `cms_site_info` 或 `cms_get_homepage` 获取。

### 工作流二：更新分类页面

```
1. cms_list_categories              → 获取目标分类的 ID 和 pageId
2. cms_get_page_schema              → 了解占位符和示例
3. cms_get_placeholder_rules				→ 获取插件占位符使用规则
4. 生成 HTML 模板                    → 通常包含 data-cms-posts (该分类文章列表)
5. cms_upload_page_html {            → 上传到该分类关联的页面
     pageId: "<分类的pageId>",
     filePath: "/path/to/category.html",
     title: "<分类名称>"
   }
6. cms_render_page { pageId: "..." } → 预览渲染效果
```

> 分类页面模板通常使用 `data-cms-posts data-category="<slug>"` 来自动渲染该分类下的文章。

### 工作流三：发布帖子

```
1. cms_list_categories              → 获取目标分类 ID
2. cms_upload_media (可选)           → 上传封面图，获取 URL
3. cms_get_placeholder_rules				→ 获取插件占位符使用规则
4. 生成 HTML 模版											→ 通常包含占位符
5. cms_create_post {                 → 发布帖子
     title: "帖子标题",
     content: "<h2>正文 HTML</h2><p>...</p>",
     categoryId: "<分类ID>",
     imageUrl: "<上传得到的URL>",   // 可选
     status: "PUBLISHED"
   }
6. 告知用户帖子已发布及访问 URL
```

### 工作流四：更新已有帖子

```
1. cms_list_posts { status: "PUBLISHED", search: "关键词" } → 搜索目标帖子
2. cms_get_post { id: "..." }                               → 查看当前内容
3. cms_upload_media (可选)                                   → 上传新图片
4. cms_get_placeholder_rules				→ 获取插件占位符使用规则
5. cms_update_post {                                         → 更新
     id: "...",
     content: "<更新后的HTML>",
     ...
   }
```

### 工作流五：创建新页面

```
1. cms_create_page(title, slug) → 得到 pageId
2. cms_get_page_schema              → 了解占位符和示例
3. cms_get_placeholder_rules				→ 获取插件占位符使用规则
4. cms_upload_media (可选)           → 上传配图，获取 URL 嵌入模板
5. 生成 HTML 模板（含 data-cms-*）   → AI 根据站点需求编写模板
6. cms_upload_page_html(pageId, filePath) → 上传 HTML
7. cms_render_page(pageId) → 预览效果
```

## 注意事项

- 页面 HTML 中的 `data-cms-*` 占位符只在**页面渲染时**替换，上传时原样存储
- `cms_upload_page_html` 接收本地 HTML 文件路径，需先将生成的 HTML 保存到本地文件
- 帖子 `content` 是完整 HTML，不使用占位符系统（占位符仅用于 Page）
- 图片上传后返回的 URL 格式为 `/uploads/filename.png`，可直接嵌入 HTML
- Token 从 CMS 管理后台 → 用户管理 → 点击「生成 Token」获取
- 每次更新页面/帖子后，建议调用 `cms_render_page` 或告知用户去前台确认效果

## ⚠️ HTML 模板规则（必须遵守）

- **禁止在模板中写入 fallback / empty-state 占位内容**（如 `<div class="empty-state">还没有文章</div>` 或类似的「暂无内容」提示）。渲染器只做占位符替换，不做 DOM 清理。如果数据为空，渲染后的 HTML 自然会显示空列表，无需占位文案。
- **禁止在模板 `<style>` 中写入 empty-state 相关 CSS**（如 `.empty-state { ... }`）。原因同上 — 模板不负责空状态展示。
- 模板只需定义**有数据时的布局**。`data-cms-posts` 和 `data-cms-categories` 占位符在有数据时渲染卡片，无数据时输出为空，由前端样式自然留白即可。
- 如果确实需要在无数据时给提示，应在 CMS 后台的页面编辑器中通过 `data-cms-plugin` 插件占位符实现，**不要**硬编码到模板 HTML 中。
