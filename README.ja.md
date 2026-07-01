[中文](README.zh.md) · [English](README.en.md) · [日本語](README.ja.md)

---

# AI CMS — AI 搭載ウェブサイトビルダー

**Next.js 16 + Prisma + SQLite** で構築されたフルスタック CMS。AI 機能と **MCP プロトコル** を深く統合し、AI エージェントがサイトコンテンツの管理、ページ生成、記事投稿を直接操作できます。

## 技術スタック

| 層 | 技術 |
|----|------|
| フレームワーク | Next.js 16.2 (App Router) · React 19.2 |
| 言語 | TypeScript (strict) |
| データベース | Prisma 6.19 + SQLite |
| 認証 | JWT (jose) · httpOnly Cookie + Bearer API Token |
| スタイリング | Tailwind CSS 4 + @tailwindcss/typography |
| エディタ | CodeMirror 6 (HTML ソース編集) |
| バリデーション | Zod 4 |
| AI | OpenAI 互換 API · SSE ストリーミング · Vision マルチモーダル |
| AI 統合 | MCP Server (`@modelcontextprotocol/sdk`) |

## クイックスタート

```bash
# 環境変数の初期化 (JWT_SECRET を必ず変更すること)
cp env.example .env

# 依存関係のインストール
npm install

# データベースの初期化
npx prisma db push
npm run db:seed

# 開発サーバーの起動
npm run dev
# → フロントエンド: http://localhost:3000
# → 管理画面: http://localhost:3000/admin
```

デフォルト管理者アカウント: `admin` / `admin123`

### 環境変数

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-me-in-production"
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
```

## プロジェクト構成

```
cms/
├── prisma/                  # データモデル & シードデータ
│   ├── schema.prisma        # 12 モデル定義
│   └── seed.ts              # デフォルト管理者 & サンプルデータ
├── src/
│   ├── app/
│   │   ├── page.tsx                 # ホームページ (SSR 動的レンダリング)
│   │   ├── [categorySlug]/         # カテゴリページ & 記事詳細
│   │   ├── (admin)/admin/          # 管理ダッシュボード
│   │   └── api/                    # REST API (20+ エンドポイント)
│   ├── components/          # 共有 UI コンポーネント
│   ├── generated/prisma/    # Prisma Client (自動生成)
│   └── lib/
│       ├── auth.ts          # JWT 認証
│       ├── hooks.ts         # WordPress 風フックシステム
│       ├── page-renderer.ts # ページレンダリングエンジン
│       ├── placeholder-registry.ts # プレースホルダレジストリ
│       ├── plugin-loader.ts # プラグイン動的ローダー
│       ├── prisma.ts        # Prisma シングルトン
│       └── plugins/         # 組み込みプラグイン
│          
├── mcp/                     # MCP Server (AI エージェントゲートウェイ)
│   └── server.js            # 30+ ツール定義
├── doc/                     # プロジェクトドキュメント
├── skills/                  # AI スキル定義
└── public/uploads/          # ファイルアップロードディレクトリ
```

## 主要機能

### 1. コンテンツ管理

- **カテゴリ / 記事 / タグ**: 完全な CRUD + バッチ操作
- **カスタムページ**: 独立した Page モデル、HTML プレースホルダ + AI 生成対応
- **バージョン管理**: 記事/ページの編集履歴、ロールバック対応
- **国際化**: 多言語翻訳管理、ポリモーフィック関連
- **メディアライブラリ**: ファイルアップロード & 管理

### 2. ページレンダリングエンジン

ホームページは Page + プレースホルダシステムで動的レンダリング：

- **データバインディング**: `{post.title}` / `{post.content}` などのテンプレート構文
- **プラグインプレースホルダ**: `data-cms-plugin="ecommerce:productGrid"` をプラグインが注入
- **フックシステム**: WordPress 風 `add_action` / `add_filter` / `apply_filters`

レンダリングパイプライン：

```
before_render_page → filter_page_content → 静的バインディング置換
→ register_placeholders → プラグインプレースホルダレンダリング
→ wp_head / wp_footer → filter_rendered_html
```

### 3. プラグインシステム

プラグインは `src/lib/plugins/<slug>/` に配置し、`index.ts` を公開するだけで自動検出・読み込み。コア API：

| API | 説明 |
|-----|------|
| `add_action(hook, callback)` | アクションフックの登録 |
| `add_filter(hook, callback)` | フィルターフックの登録 |
| `register_placeholder(name, renderer)` | プレースホルダレンダラーの登録 |
| `registerPluginApiRoute('/', router)` | `/api/plugin/<slug>/*` ルートの登録 |

組み込みフック：

| フック | タイプ | 用途 |
|--------|--------|------|
| `register_placeholders` | Action | プレースホルダ登録 |
| `wp_head` | Filter | `<head>` コンテンツ注入 |
| `wp_footer` | Filter | フッタースクリプト注入 |
| `admin_menu` | Filter | 管理サイドバーメニュー注入 |
| `admin_page_<slug>` | Filter | プラグイン管理ページ |
| `filter_page_content` | Filter | ページコンテンツ前処理 |
| `filter_rendered_html` | Filter | グローバル HTML 後処理 |

### 4. AI 機能

- **AI ページ生成**: 説明を入力 → ストリーミング HTML ページ生成
- **AI 記事生成**: トピックを入力 → タイトル + 本文を自動生成
- **Vision マルチモーダル**: デザインモックアップをアップロード → AI が認識してページを生成
- **AI スタイル生成**: 説明から Markdown スタイル定義を生成

### 5. MCP プロトコル (AI エージェント直接操作)

30 以上の MCP ツールで、AI エージェントが標準 MCP プロトコル経由で CMS を操作：

```bash
# MCP Server の起動
cd mcp && node server.js
```

主なツール：

| ツール | 説明 |
|--------|------|
| `cms_site_info` | サイト概要の取得 |
| `cms_list_posts` | 記事一覧 |
| `cms_create_post` | 記事作成 |
| `cms_update_post` | 記事更新 |
| `cms_list_categories` | カテゴリ一覧 |
| `cms_create_page_html` | AI ページ生成 |
| `cms_deploy_page` | ページのデプロイ/更新 |
| `cms_upload_media` | メディアファイルのアップロード |
| `cms_manage_plugin` | プラグイン管理 |
| … | (全 30+ ツール) |

環境変数：

```env
CMS_API_URL=http://localhost:3000/
CMS_API_TOKEN=<ユーザー API トークン>
```

### 6. 権限システム

3 段階ロール: `SUPER_ADMIN` > `ADMIN` > `EDITOR`

2 つの認証方式：
- **Cookie**: 管理ページ用 (httpOnly, SameSite=Lax)
- **API Token**: MCP Server / 外部 API 呼び出し用

## API エンドポイント

| モジュール | エンドポイント |
|-----------|---------------|
| 認証 | `POST /api/auth/token` · `POST /api/auth/logout` |
| カテゴリ | `GET/POST /api/categories` · `GET/PATCH/DELETE /api/categories/[id]` |
| 記事 | `GET/POST /api/posts` · `GET/PATCH/DELETE /api/posts/[id]` |
| タグ | `GET/POST /api/tags` · `GET/PATCH/DELETE /api/tags/[id]` |
| ページ | `GET/POST /api/pages` · `GET/PATCH/DELETE /api/pages/[id]` |
| メディア | `GET/POST /api/media` · `DELETE /api/media/[id]` |
| ホームページ | `GET/PATCH /api/homepage` |
| 設定 | `GET/PATCH /api/settings` · `/api/settings/llm` · `/api/settings/site` |
| 検索 | `GET /api/search?q=` |
| バージョン | `GET /api/versions/[type]/[id]` · POST ロールバック |
| サイト | `GET /api/site` (サイト状態概要) |
| プラグイン | `/api/plugins/*` · `/api/plugin/<slug>/*` |
| スキル | `GET /api/skills` · `/api/schema/placeholders` |

## データベース

デフォルト: SQLite (`prisma/dev.db`)。MySQL/PostgreSQL に切り替え可能：

```bash
npx prisma db push     # スキーマをデータベースに同期
npx prisma studio      # ビジュアルデータブラウザ
npm run db:seed        # シードデータ再初期化
```

12 データモデル: User · Category · Post · Tag · PostTag · Page · PageImage · Media · Style · Plugin · Setting · ContentVersion · Translation · SiteLanguage

## デプロイ

```bash
npm run build   # プロダクションビルド
npm start       # プロダクションサーバー起動 (デフォルト :3000)
```

本番環境では必ず `JWT_SECRET` を変更し、LLM API Key を設定してください。

## ドキュメント

詳細ドキュメントは `doc/` ディレクトリを参照：

- `项目总览：AI CMS（辰星科技 AI 建站工具）.md` — アーキテクチャ & データモデル
- `插件功能详解.md` — フックシステム、プレースホルダ、プラグイン開発
- `AI建站工具` — AI ページ生成ガイド
