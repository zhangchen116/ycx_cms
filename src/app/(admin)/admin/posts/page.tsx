"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TagSelector from "@/components/TagSelector";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  tags: string;
  tagIds: string[];
  aiGenerated: boolean;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  author: { id: string; username: string };
}

interface Category {
  id: string;
  name: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filter, setFilter] = useState({ categoryId: "", status: "", q: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const aiEnabled = useAIEnabled();

  const fetchPosts = (page = 1) => {
    const params = new URLSearchParams();
    if (filter.categoryId) params.set("categoryId", filter.categoryId);
    if (filter.status) params.set("status", filter.status);
    if (filter.q) params.set("q", filter.q);
    params.set("page", String(page));

    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts);
        setPagination(data.pagination);
      });
  };

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => { fetchPosts(); }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除？删除后不可恢复。")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">帖子管理</h1>
        <div className="flex gap-2">
          {aiEnabled && (
          <button
            onClick={() => { setShowAI(true); setShowCreate(false); }}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
          >
            AI 生成
          </button>
          )}
          <button
            onClick={() => { setShowCreate(true); setShowAI(false); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            新建帖子
          </button>
        </div>
      </div>

      {/* AI Generate Panel */}
      {aiEnabled && showAI && (
        <AIGeneratePanel
          categories={categories}
          onDone={() => { setShowAI(false); fetchPosts(); }}
        />
      )}

      {/* Create Panel */}
      {showCreate && (
        <CreatePostPanel
          categories={categories}
          onDone={() => { setShowCreate(false); fetchPosts(); }}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filter.categoryId}
          onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">全部状态</option>
          <option value="PUBLISHED">已发布</option>
          <option value="DRAFT">草稿</option>
        </select>
        <input
          type="text"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="搜索标题或正文..."
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">标题</th>
              <th className="text-left px-4 py-2">分类</th>
              <th className="text-left px-4 py-2">状态</th>
              <th className="text-left px-4 py-2">作者</th>
              <th className="text-left px-4 py-2">时间</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">
                    {p.aiGenerated && <span className="text-xs bg-purple-100 text-purple-600 px-1 py-0.5 rounded mr-1">AI</span>}
                    {p.title}
                  </div>
                  {p.tags && <div className="text-xs text-gray-400 mt-0.5">{p.tags}</div>}
                </td>
                <td className="px-4 py-2 text-gray-500">{p.category.name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {p.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">{p.author.username}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Link href={`/admin/posts/${p.id}`} className="text-blue-600 hover:underline text-xs">
                    编辑
                  </Link>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无帖子</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => fetchPosts(i + 1)}
              className={`px-3 py-1 text-sm rounded ${pagination.page === i + 1 ? "bg-blue-600 text-white" : "bg-white border hover:bg-gray-50"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──── AI Generate Panel ────

function AIGeneratePanel({ categories, onDone }: { categories: Category[]; onDone: () => void }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState<string>("");
  const [imageUrls, setImageUrls] = useState("");

  const handleGenerate = async () => {
    if (!categoryId || !prompt) return;
    setGenerating(true);
    setStreaming("");

    const urls = imageUrls.split("\n").filter(Boolean);
    const res = await fetch("/api/posts/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, prompt, imageUrls: urls.length > 0 ? urls : undefined }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.message) setStreaming((s) => s + data.message + "\n");
            if (data.post) { setGenerating(false); onDone(); return; }
            if (data.error) { setStreaming((s) => s + "错误: " + data.message + "\n"); setGenerating(false); }
          } catch { /* ignore */ }
        }
      }
    }
    setGenerating(false);
  };

  return (
    <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-purple-200">
      <h3 className="font-semibold mb-3 text-purple-700">AI 生成帖子</h3>
      <div className="space-y-3">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入生成提示，如：写一篇关于 AI 发展趋势的科技文章..."
          className="w-full border rounded px-3 py-2 text-sm"
          rows={3}
        />
        <textarea
          value={imageUrls}
          onChange={(e) => setImageUrls(e.target.value)}
          placeholder="配图URL（每行一个，可选）"
          className="w-full border rounded px-3 py-2 text-sm"
          rows={2}
        />
        {streaming && <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-wrap">{streaming}</pre>}
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {generating ? "生成中..." : "开始生成"}
        </button>
      </div>
    </div>
  );
}

// ──── Create Post Panel ────

function CreatePostPanel({ categories, onDone }: { categories: Category[]; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug || undefined,
        content,
        categoryId,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        status,
      }),
    });
    if (res.ok) onDone();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 mb-6 shadow-sm">
      <h3 className="font-semibold mb-3">新建帖子</h3>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题 *"
          className="w-full border rounded px-3 py-2 text-sm"
          required
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="URL 标识（留空自动生成）"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">发布</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="正文（Markdown）*"
          className="w-full border rounded px-3 py-2 text-sm"
          rows={8}
          required
        />
        <TagSelector selectedIds={tagIds} onChange={setTagIds} />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}
