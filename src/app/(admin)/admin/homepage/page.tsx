"use client";

import { useEffect, useState, useRef } from "react";
import CodeMirrorEditor from "@/components/CodeMirrorEditor";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface Style {
  id: string;
  name: string;
}

interface HomePageData {
  id: string;
  title: string;
  status: string;
  content?: string | null;
  styleId: string | null;
  style?: { id: string; name: string };
}

type Tab = "settings" | "source";

export default function AdminHomePage() {
  const [page, setPage] = useState<HomePageData | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("PUBLISHED");
  const [styleId, setStyleId] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("settings");

  const aiEnabled = useAIEnabled();

  // AI generate
  const [requirements, setRequirements] = useState("");
  const [refImages, setRefImages] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");
  const aiAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/homepage").then((r) => r.json()).then((d) => {
      if (d) {
        setPage(d);
        setTitle(d.title || "");
        setStatus(d.status || "PUBLISHED");
        setStyleId(d.styleId ?? "");
        setContent(d.content ?? "");
      }
    });
    fetch("/api/styles").then((r) => r.json()).then(setStyles);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await fetch("/api/homepage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status, styleId: styleId || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const updated = await res.json();
      setPage(updated);
    }
  };

  const handleSaveSource = async () => {
    setSaving(true);
    const res = await fetch("/api/homepage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const updated = await res.json();
      setPage(updated);
    }
  };

  const handleAIGenerate = async () => {
    setAiError("");
    setAiStatus("连接中...");
    const controller = new AbortController();
    aiAbort.current = controller;

    try {
      const res = await fetch("/api/homepage/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements,
          referenceImageUrls: refImages
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setAiError(err.error || "生成失败");
        return;
      }

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
              case "done":
                if (data.title) setTitle(data.title);
                setAiStatus("生成完成！");
                break;
              case "error":
                setAiError(data.message || "生成失败");
                break;
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setAiError("生成请求失败");
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">首页设置</h1>

      {/* Tabs */}
      <div className="flex gap-0 mb-0 bg-white rounded-t-lg shadow-sm">
        <button className={tabClass("settings")} onClick={() => setTab("settings")}>
          基本设置
        </button>
        <button className={tabClass("source")} onClick={() => setTab("source")}>
          源码编辑
        </button>
      </div>

      {/* Tab: 基本设置 */}
      {tab === "settings" && (
        <div className="bg-white rounded-b-lg rounded-tr-lg p-6 shadow-sm mb-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-4">页面信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">页面标题</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="网站首页标题"
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
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              {saved && <span className="text-green-600 text-sm">已保存</span>}
            </div>
          </div>

          {/* AI Generate */}
          {aiEnabled && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">🤖 AI 生成</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">生成要求</label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="描述你想要的首页风格，例如：科技感、简洁、暗色主题"
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">参考图片 URL（每行一个）</label>
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
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
              >
                开始生成
              </button>
              {aiStatus && (
                <div className="text-sm">
                  <span className="text-purple-600">{aiStatus}</span>
                  {aiStatus.includes("生成中") && (
                    <button
                      onClick={() => aiAbort.current?.abort()}
                      className="ml-2 text-red-500 text-xs hover:underline"
                    >
                      取消
                    </button>
                  )}
                </div>
              )}
              {aiError && <div className="text-sm text-red-500">{aiError}</div>}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab: 源码编辑 */}
      {tab === "source" && (
        <div className="bg-white rounded-b-lg rounded-tr-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">HTML 源码编辑</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (page?.id) {
                    window.open("/", "_blank");
                  }
                }}
                className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                预览 →
              </button>
              <button
                onClick={handleSaveSource}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存源码"}
              </button>
              {saved && <span className="text-green-600 text-sm self-center">已保存</span>}
            </div>
          </div>

          {page ? (
            <CodeMirrorEditor
              value={content}
              onChange={setContent}
              height="500px"
              placeholder="输入 HTML 源码..."
            />
          ) : (
            <div className="border rounded-lg bg-gray-50 flex items-center justify-center h-40 text-gray-400 text-sm">
              加载中...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
