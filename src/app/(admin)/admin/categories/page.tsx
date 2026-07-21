"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirrorEditor from "@/components/CodeMirrorEditor";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface Category {
  id: string;
  name: string;
  slug: string;
  order: number;
  _count: { posts: number };
  page?: { id: string; title: string; status: string; styleId?: string | null } | null;
}

interface Style {
  id: string;
  name: string;
}

type PageEditorTab = "settings" | "source";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const aiEnabled = useAIEnabled();

  const fetchCategories = () =>
    fetch("/api/categories").then((r) => r.json()).then(setCategories);

  useEffect(() => {
    fetchCategories();
    fetch("/api/styles").then((r) => r.json()).then(setStyles);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: slug || undefined }),
    });
    if (res.ok) {
      setName("");
      setSlug("");
      setShowForm(false);
      fetchCategories();
    } else {
      const err = await res.json();
      alert(err.error || "创建失败");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该分类及其所有内容？")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    fetchCategories();
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    await fetch("/api/categories/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, direction }),
    });
    fetchCategories();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">分类管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          {showForm ? "取消" : "新建分类"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL 标识</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="留空自动生成"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">名称</th>
              <th className="text-left px-4 py-2">URL</th>
              <th className="text-left px-4 py-2">页面标题</th>
              <th className="text-left px-4 py-2">帖子数</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-gray-500">/{c.slug}</td>
                <td className="px-4 py-2 text-gray-500">{c.page?.title || "-"}</td>
                <td className="px-4 py-2">{c._count.posts}</td>
                <td className="px-4 py-2 text-right space-x-1">
                  <button
                    onClick={() => handleReorder(c.id, "up")}
                    className="text-gray-400 hover:text-gray-700 text-xs px-1"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleReorder(c.id, "down")}
                    className="text-gray-400 hover:text-gray-700 text-xs px-1"
                    title="下移"
                  >
                    ↓
                  </button>
                  {c.page && (
                    <PageEditor
                      pageId={c.page.id}
                      pageTitle={c.page.title}
                      pageStatus={c.page.status}
                      styleId={c.page.styleId}
                      styles={styles}
                      categoryId={c.id}
                      categoryName={c.name}
                      categorySlug={c.slug}
                      aiEnabled={aiEnabled}
                      onUpdated={fetchCategories}
                    />
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无分类</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- Page Editor Modal ---- */

function PageEditor({
  pageId,
  pageTitle,
  pageStatus,
  styleId: initialStyleId,
  styles,
  categoryId,
  categoryName,
  categorySlug,
  aiEnabled,
  onUpdated,
}: {
  pageId: string;
  pageTitle: string;
  pageStatus: string;
  styleId?: string | null;
  styles: Style[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  aiEnabled: boolean;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(pageTitle);
  const [status, setStatus] = useState(pageStatus);
  const [styleId, setStyleId] = useState(initialStyleId ?? "");
  const [saving, setSaving] = useState(false);

  // Source code editing
  const [content, setContent] = useState("");
  const [contentLoaded, setContentLoaded] = useState(false);
  const [tab, setTab] = useState<PageEditorTab>("settings");

  // AI generate
  const [aiOpen, setAiOpen] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [refImages, setRefImages] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");
  const aiAbort = useRef<AbortController | null>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setTitle(pageTitle);
    setStatus(pageStatus);
    setStyleId(initialStyleId ?? "");
    setAiOpen(false);
    setAiStatus("");
    setAiError("");
    setTab("settings");
    setContentLoaded(false);
    // Fetch full page data for content
    fetch(`/api/pages?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.content != null) {
          setContent(data.content);
        } else {
          setContent("");
        }
        setContentLoaded(true);
      })
      .catch(() => {
        setContent("");
        setContentLoaded(true);
      });
  }, [pageTitle, pageStatus, initialStyleId, categoryId]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status, styleId: styleId || null }),
    });
    setSaving(false);
    setOpen(false);
    onUpdated();
  };

  const handleSaveSource = async () => {
    setSaving(true);
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      onUpdated();
    }
  };

  const handleAIGenerate = async () => {
    setAiError("");
    setAiStatus("连接中...");
    const controller = new AbortController();
    aiAbort.current = controller;

    try {
      const refUrls = refImages
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/pages/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          requirements,
          referenceImageUrls: refUrls.length > 0 ? refUrls : undefined,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) continue;
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            switch (data.event) {
              case "generating":
                setAiStatus(data.message || "生成中...");
                break;
              case "content":
                setAiStatus("正在处理生成结果...");
                break;
              case "done":
                if (data.pageTitle) setTitle(data.pageTitle);
                setAiStatus("生成完成！");
                onUpdated();
                break;
              case "error":
                setAiError(data.message || "生成失败");
                break;
            }
          } catch {
            // skip unparseable
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setAiError("生成请求失败");
    }
  };

  const handleCancelAI = () => {
    aiAbort.current?.abort();
    setAiStatus("");
  };

  const tabClass = (t: PageEditorTab) =>
    `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  if (!open) {
    return (
      <button onClick={handleOpen} className="text-blue-600 hover:underline text-xs">
        编辑页面
      </button>
    );
  }

  return (
    <>
      <button onClick={handleOpen} className="text-blue-600 hover:underline text-xs">
        编辑页面
      </button>

      {/* Modal */}
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">编辑页面 - {categoryName}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-4 border-b">
              <button className={tabClass("settings")} onClick={() => setTab("settings")}>
                基本设置
              </button>
              <button className={tabClass("source")} onClick={() => setTab("source")}>
                源码编辑
              </button>
            </div>

            {/* Tab: 基本设置 */}
            {tab === "settings" && (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">页面标题</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">发布状态</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="DRAFT">草稿</option>
                        <option value="PUBLISHED">已发布</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">样式模板</label>
                      <select
                        value={styleId}
                        onChange={(e) => setStyleId(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">默认样式</option>
                        {styles.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* AI Generate */}
                  {aiEnabled && (!aiOpen ? (
                    <button
                      onClick={() => setAiOpen(true)}
                      className="text-purple-600 text-sm hover:underline"
                    >
                      🤖 AI 生成页面内容
                    </button>
                  ) : (
                    <div className="border rounded p-3 bg-purple-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-purple-700">AI 生成</span>
                        <button onClick={() => { setAiOpen(false); handleCancelAI(); }} className="text-xs text-gray-500 hover:underline">收起</button>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">生成要求</label>
                        <textarea
                          value={requirements}
                          onChange={(e) => setRequirements(e.target.value)}
                          placeholder="描述你想要的页面风格和内容"
                          rows={3}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">参考图片 URL（每行一个）</label>
                        <textarea
                          value={refImages}
                          onChange={(e) => setRefImages(e.target.value)}
                          placeholder="https://example.com/ref.png"
                          rows={2}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        onClick={handleAIGenerate}
                        className="bg-purple-600 text-white px-4 py-1.5 rounded text-sm hover:bg-purple-700"
                      >
                        开始生成
                      </button>
                      {aiStatus && (
                        <div className="text-sm">
                          <span className="text-purple-600">{aiStatus}</span>
                          {aiStatus === "生成中..." && (
                            <button onClick={handleCancelAI} className="ml-2 text-red-500 text-xs hover:underline">取消</button>
                          )}
                        </div>
                      )}
                      {aiError && <div className="text-sm text-red-500">{aiError}</div>}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-2 justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}

            {/* Tab: 源码编辑 */}
            {tab === "source" && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        window.open(`/${categorySlug}`, "_blank");
                      }}
                      className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50"
                    >
                      预览 →
                    </button>
                  </div>
                  {contentLoaded ? (
                    <CodeMirrorEditor
                      value={content}
                      onChange={setContent}
                      height="350px"
                      placeholder="输入 HTML 源码..."
                    />
                  ) : (
                    <div className="border rounded-lg bg-gray-50 flex items-center justify-center h-[350px] text-gray-400 text-sm">
                      加载中...
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-2 justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveSource}
                    disabled={saving || !contentLoaded}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存源码"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
