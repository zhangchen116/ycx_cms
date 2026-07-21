"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirrorEditor from "@/components/CodeMirrorEditor";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface Page {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  content?: string | null;
  styleId?: string | null;
  style?: { id: string; name: string } | null;
}

interface Style {
  id: string;
  name: string;
}

type PageEditorTab = "settings" | "source";

export default function StandalonePagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [homepageId, setHomepageId] = useState<string | null>(null);
  const aiEnabled = useAIEnabled();

  const fetchPages = () =>
    fetch("/api/pages?type=STANDALONE").then((r) => r.json()).then(setPages);

  useEffect(() => {
    fetchPages();
    fetch("/api/styles").then((r) => r.json()).then(setStyles);
    fetch("/api/homepage").then((r) => r.json())
      .then((data) => setHomepageId(data?.id || null));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    setLoading(true);
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, type: "STANDALONE" }),
    });
    if (res.ok) {
      setTitle("");
      setSlug("");
      setShowForm(false);
      fetchPages();
    } else {
      const err = await res.json();
      alert(err.error || "创建失败");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该独立页？")) return;
    await fetch(`/api/pages/${id}`, { method: "DELETE" });
    fetchPages();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">独立页管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          {showForm ? "取消" : "新建独立页"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL 标识 *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="如 user-notice"
                className="w-full border rounded px-3 py-2 text-sm"
                required
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
              <th className="text-left px-4 py-2">标题</th>
              <th className="text-left px-4 py-2">URL</th>
              <th className="text-left px-4 py-2">状态</th>
              <th className="text-left px-4 py-2">样式</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-medium">{p.title}</td>
                <td className="px-4 py-2 text-gray-500">
                  <a
                    href={`/page/${p.slug}`}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    /page/{p.slug}
                  </a>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      p.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">{p.style?.name || "默认"}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  {p.id === homepageId ? (
                    <span className="text-xs text-gray-400">系统首页</span>
                  ) : (
                    <>
                      <StandalonePageEditor
                        page={p}
                        styles={styles}
                        aiEnabled={aiEnabled}
                        onUpdated={fetchPages}
                      />
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        删除
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  暂无独立页，点击"新建独立页"创建
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- Page Editor Modal ---- */

function StandalonePageEditor({
  page,
  styles,
  aiEnabled,
  onUpdated,
}: {
  page: Page;
  styles: Style[];
  aiEnabled: boolean;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlugState] = useState(page.slug);
  const [status, setStatus] = useState(page.status);
  const [styleId, setStyleId] = useState(page.styleId ?? "");
  const [saving, setSaving] = useState(false);

  // Source editing
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
    setTitle(page.title);
    setSlugState(page.slug);
    setStatus(page.status);
    setStyleId(page.styleId ?? "");
    setAiOpen(false);
    setAiStatus("");
    setAiError("");
    setTab("settings");
    setContentLoaded(false);
    fetch(`/api/pages/${page.id}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content ?? "");
        setContentLoaded(true);
      })
      .catch(() => setContentLoaded(true));
  }, [page]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, status, styleId: styleId || null }),
    });
    setSaving(false);
    setOpen(false);
    onUpdated();
  };

  const handleSaveSource = async () => {
    setSaving(true);
    const res = await fetch(`/api/pages/${page.id}`, {
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
          pageId: page.id,
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
                if (data.content) setContent(data.content);
                setAiStatus("生成完成！");
                onUpdated();
                break;
              case "error":
                setAiError(data.message || "生成失败");
                break;
            }
          } catch { /* skip */ }
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
        编辑
      </button>
    );
  }

  return (
    <>
      <button onClick={handleOpen} className="text-blue-600 hover:underline text-xs">
        编辑
      </button>

      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">编辑独立页</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="flex gap-0 mb-4 border-b">
              <button className={tabClass("settings")} onClick={() => setTab("settings")}>
                基本设置
              </button>
              <button className={tabClass("source")} onClick={() => setTab("source")}>
                源码编辑
              </button>
            </div>

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
                  <div>
                    <label className="block text-sm font-medium mb-1">URL 标识</label>
                    <input
                      value={slug}
                      onChange={(e) => setSlugState(e.target.value)}
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

                  <div className="flex gap-2">
                    <a
                      href={`/page/${page.slug}`}
                      target="_blank"
                      className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50"
                    >
                      预览 →
                    </a>
                    {aiEnabled && !aiOpen && (
                      <button
                        onClick={() => setAiOpen(true)}
                        className="text-purple-600 text-sm hover:underline"
                      >
                        🤖 AI 生成页面内容
                      </button>
                    )}
                  </div>

                  {aiOpen && (
                    <div className="border rounded p-3 bg-purple-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-purple-700">AI 生成</span>
                        <button
                          onClick={() => { setAiOpen(false); handleCancelAI(); }}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          收起
                        </button>
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
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}

            {tab === "source" && (
              <>
                <div className="space-y-3">
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
