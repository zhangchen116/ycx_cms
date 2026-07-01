[中文](README.zh.md) · [English](README.en.md) · [日本語](README.ja.md)

---

# AI CMS — AI-Powered Website Builder

A full-stack content management system built on **Next.js 16 + Prisma + SQLite**, with deep AI integration and **MCP protocol** support, enabling AI Agents to directly manage site content, generate pages, and publish posts.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2 (App Router) · React 19.2 |
| Language | TypeScript (strict) |
| Database | Prisma 6.19 + SQLite |
| Auth | JWT (jose) · httpOnly Cookie + Bearer API Token |
| Styling | Tailwind CSS 4 + @tailwindcss/typography |
| Editor | CodeMirror 6 (HTML source editing) |
| Validation | Zod 4 |
| AI | OpenAI-compatible API · SSE streaming · Vision multimodal |
| AI Integration | MCP Server (`@modelcontextprotocol/sdk`) |

## Quick Start

```bash
# Initialize env (make sure to change JWT_SECRET)
cp env.example .env

# Install dependencies
npm install

# Initialize database
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
# → Frontend: http://localhost:3000
# → Admin: http://localhost:3000/admin
```

Default admin account: `admin` / `admin123`

### Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-me-in-production"
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
```

## Project Structure

```
cms/
├── prisma/                  # Data models & seed data
│   ├── schema.prisma        # 12 model definitions
│   └── seed.ts              # Default admin & sample data
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Homepage (SSR dynamic render)
│   │   ├── [categorySlug]/         # Category pages & post detail
│   │   ├── (admin)/admin/          # Admin dashboard
│   │   └── api/                    # REST API (20+ endpoints)
│   ├── components/          # Shared UI components
│   ├── generated/prisma/    # Prisma Client (auto-generated)
│   └── lib/
│       ├── auth.ts          # JWT authentication
│       ├── hooks.ts         # WordPress-style Hook system
│       ├── page-renderer.ts # Page rendering engine
│       ├── placeholder-registry.ts # Placeholder registry
│       ├── plugin-loader.ts # Plugin dynamic loader
│       ├── prisma.ts        # Prisma singleton
│       └── plugins/         # Built-in plugins
│           
├── mcp/                     # MCP Server (AI Agent gateway)
│   └── server.js            # 30+ tool definitions
├── doc/                     # Project documentation
├── skills/                  # AI Skill definitions
└── public/uploads/          # File upload directory
```

## Core Features

### 1. Content Management

- **Categories / Posts / Tags**: Full CRUD + batch operations
- **Custom Pages**: Independent Page model with HTML placeholders + AI generation
- **Version Control**: Edit history for posts/pages with rollback support
- **Internationalization**: Multi-language translation management with polymorphic relations
- **Media Library**: File upload & management

### 2. Page Rendering Engine

The homepage is dynamically rendered via Page + placeholder system, supporting:

- **Data Binding**: Template syntax like `{post.title}` / `{post.content}`
- **Plugin Placeholders**: `data-cms-plugin="ecommerce:productGrid"` injected by plugins
- **Hook System**: WordPress-style `add_action` / `add_filter` / `apply_filters`

Rendering pipeline:

```
before_render_page → filter_page_content → static binding replacement
→ register_placeholders → plugin placeholder rendering
→ wp_head / wp_footer → filter_rendered_html
```

### 3. Plugin System

Plugins live in `src/lib/plugins/<slug>/`. Expose `index.ts` for auto-discovery. Core APIs:

| API | Description |
|-----|-------------|
| `add_action(hook, callback)` | Register action hook |
| `add_filter(hook, callback)` | Register filter hook |
| `register_placeholder(name, renderer)` | Register placeholder renderer |
| `registerPluginApiRoute('/', router)` | Register `/api/plugin/<slug>/*` routes |

Built-in hooks:

| Hook | Type | Purpose |
|------|------|---------|
| `register_placeholders` | Action | Register placeholders |
| `wp_head` | Filter | Inject `<head>` content |
| `wp_footer` | Filter | Inject footer scripts |
| `admin_menu` | Filter | Admin sidebar menu injection |
| `admin_page_<slug>` | Filter | Plugin admin page |
| `filter_page_content` | Filter | Page content pre-processing |
| `filter_rendered_html` | Filter | Global HTML post-processing |

### 4. AI Capabilities

- **AI Page Generation**: Describe → streaming HTML page generation
- **AI Post Generation**: Topic in → title + body out
- **Vision Multimodal**: Upload a design mockup, AI recognizes and generates the page
- **AI Style Generation**: Describe → Markdown style definition

### 5. MCP Protocol (Direct AI Agent Control)

30+ MCP tools for AI Agents to control the CMS via standard MCP protocol:

```bash
# Start MCP Server
cd mcp && node server.js
```

Selected tools:

| Tool | Description |
|------|-------------|
| `cms_site_info` | Get site overview |
| `cms_list_posts` | List posts |
| `cms_create_post` | Create post |
| `cms_update_post` | Update post |
| `cms_list_categories` | List categories |
| `cms_create_page_html` | AI page generation |
| `cms_deploy_page` | Deploy / update page |
| `cms_upload_media` | Upload media file |
| `cms_manage_plugin` | Plugin management |
| … | (30+ tools total) |

Environment:

```env
CMS_API_URL=http://localhost:3000/
CMS_API_TOKEN=<user API token>
```

### 7. Permission System

Three-tier roles: `SUPER_ADMIN` > `ADMIN` > `EDITOR`

Two authentication methods:
- **Cookie**: For admin pages (httpOnly, SameSite=Lax)
- **API Token**: For MCP Server / external API calls

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/token` · `POST /api/auth/logout` |
| Categories | `GET/POST /api/categories` · `GET/PATCH/DELETE /api/categories/[id]` |
| Posts | `GET/POST /api/posts` · `GET/PATCH/DELETE /api/posts/[id]` |
| Tags | `GET/POST /api/tags` · `GET/PATCH/DELETE /api/tags/[id]` |
| Pages | `GET/POST /api/pages` · `GET/PATCH/DELETE /api/pages/[id]` |
| Media | `GET/POST /api/media` · `DELETE /api/media/[id]` |
| Homepage | `GET/PATCH /api/homepage` |
| Settings | `GET/PATCH /api/settings` · `/api/settings/llm` · `/api/settings/site` |
| Search | `GET /api/search?q=` |
| Versions | `GET /api/versions/[type]/[id]` · POST rollback |
| Site | `GET /api/site` (site status overview) |
| Plugins | `/api/plugins/*` · `/api/plugin/<slug>/*` |
| Skills | `GET /api/skills` · `/api/schema/placeholders` |

## Database

Default: SQLite (`prisma/dev.db`). Switchable to MySQL/PostgreSQL:

```bash
npx prisma db push     # Sync schema to database
npx prisma studio      # Visual data browser
npm run db:seed        # Re-initialize seed data
```

12 data models: User · Category · Post · Tag · PostTag · Page · PageImage · Media · Style · Plugin · Setting · ContentVersion · Translation · SiteLanguage

## Deployment

```bash
npm run build   # Production build
npm start       # Start production server (default :3000)
```

In production, be sure to change `JWT_SECRET` and configure your LLM API Key.

## Documentation

Detailed docs in the `doc/` directory:

- `项目总览：AI CMS（辰星科技 AI 建站工具）.md` — Architecture & data model
- `插件功能详解.md` — Hook system, placeholders, plugin development
- `AI建站工具` — AI page generation guide
