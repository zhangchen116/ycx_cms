"use client";

import { useEffect, useState } from "react";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface LLMSettings {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface SiteSettings {
  domain: string;
  port: string;
}

export default function SettingsPage() {
  const [llm, setLlm] = useState<LLMSettings>({ provider: "", apiKey: "", baseUrl: "", model: "" });
  const [site, setSite] = useState<SiteSettings>({ domain: "", port: "" });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const aiEnabled = useAIEnabled();

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((d) => setLlm({ provider: d.provider || "", apiKey: d.apiKey || "", baseUrl: d.baseUrl || "", model: d.model || "" }));
    fetch("/api/settings/site")
      .then((r) => r.json())
      .then((d) => setSite({ domain: d.domain || "", port: d.port || "" }));
  }, []);

  const handleSave = async () => {
    await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(llm),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveSite = async () => {
    await fetch("/api/settings/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(site),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      {/* LLM Settings */}
      {aiEnabled && (
      <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">大模型 API</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">API 提供商</label>
            <select
              value={llm.provider}
              onChange={(e) => setLlm({ ...llm, provider: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">选择...</option>
              <option value="openai">OpenAI</option>
              <option value="custom">自定义兼容接口</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">默认模型</label>
            <input
              value={llm.model}
              onChange={(e) => setLlm({ ...llm, model: e.target.value })}
              placeholder="gpt-4o"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={llm.apiKey}
              onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              value={llm.baseUrl}
              onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2 items-center">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            保存
          </button>
          {saved && <span className="text-green-600 text-sm">已保存</span>}
        </div>
      </div>
      )}

      {/* Site Settings */}
      <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">站点配置</h2>
        <p className="text-xs text-gray-500 mb-4">下载 Skill 时自动替换模板中的地址</p>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">域名 / IP</label>
            <input
              value={site.domain}
              onChange={(e) => setSite({ ...site, domain: e.target.value })}
              placeholder="example.com"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">端口号（默认 3000）</label>
            <input
              value={site.port}
              onChange={(e) => setSite({ ...site, port: e.target.value })}
              placeholder="3000"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2 items-center">
          <button
            onClick={handleSaveSite}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            保存
          </button>
          {saved && <span className="text-green-600 text-sm">已保存</span>}
        </div>
      </div>

      {/* OpenClaw Skill */}
      <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">OpenClaw Skill</h2>
            <p className="text-sm text-gray-500">下载 OpenClaw Skill 文件，让 AI Agent 通过 MCP 协议管理站点内容（发帖、编辑首页、上传图片等）。插件占位符说明会自动注入。</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/skills/download"
              download="ycx-cms.md"
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 whitespace-nowrap"
            >
              📄 下载 Skill 文件
            </a>
            <a
              href="/api/skills/download?format=zip"
              download="ycx-cms-skill.zip"
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 whitespace-nowrap"
            >
              📦 下载完整包
            </a>
          </div>
        </div>
      </div>

      {/* Plugins */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">功能插件</h2>
        <PluginsSection />
        <div className="mt-4 pt-4 border-t">
          <PluginUpload onUploaded={() => window.location.reload()} />
        </div>
      </div>
    </div>
  );
}

interface PluginInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  hooks: Array<{ hook: string; type: string }> | null;
}

function PluginsSection() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [editing, setEditing] = useState<PluginInfo | null>(null);

  useEffect(() => {
    fetch("/api/plugins").then((r) => r.json()).then(setPlugins);
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    await fetch("/api/plugins", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !enabled } : p)));
  };

  return (
    <div className="space-y-3">
      {plugins.map((p) => (
        <div key={p.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{p.name}</span>
                <span className="text-xs text-gray-400">v{p.version}</span>
                {p.author && <span className="text-xs text-gray-400">by {p.author}</span>}
              </div>
              {p.description && <div className="text-xs text-gray-500 mt-1">{p.description}</div>}
              {p.hooks && p.hooks.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {p.hooks.map((h, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {h.hook}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(p)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                配置
              </button>
              <button
                onClick={() => toggle(p.id, p.enabled)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  p.enabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {p.enabled ? "已启用" : "已禁用"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {plugins.length === 0 && <div className="text-gray-400 text-sm">暂无插件</div>}

      {editing && <PluginConfigModal plugin={editing} onClose={() => setEditing(null)} onSaved={(p) => {
        setPlugins((prev) => prev.map((x) => (x.id === p.id ? p : x)));
        setEditing(null);
      }} />}
    </div>
  );
}

function PluginConfigModal({
  plugin,
  onClose,
  onSaved,
}: {
  plugin: PluginInfo;
  onClose: () => void;
  onSaved: (p: PluginInfo) => void;
}) {
  const [configStr, setConfigStr] = useState(JSON.stringify(plugin.config || {}, null, 2));
  const [parseError, setParseError] = useState("");

  const handleSave = async () => {
    try {
      const config = JSON.parse(configStr);
      const res = await fetch("/api/plugins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plugin.id, config }),
      });
      const updated = await res.json();
      onSaved(updated);
    } catch {
      setParseError("JSON 格式错误");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[480px] max-h-[80vh] overflow-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2">{plugin.name} — 配置</h3>
        <p className="text-xs text-gray-500 mb-4">直接编辑 JSON 配置（与 data-cms-config 页面级参数合并，后者优先）</p>
        <textarea
          value={configStr}
          onChange={(e) => { setConfigStr(e.target.value); setParseError(""); }}
          rows={12}
          className="w-full border rounded px-3 py-2 text-xs font-mono"
        />
        {parseError && <div className="text-red-500 text-xs mt-1">{parseError}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
        </div>
      </div>
    </div>
  );
}

function PluginUpload({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/plugins/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ ${data.plugin?.name || file.name} 安装成功`);
        onUploaded();
      } else {
        setMsg(`❌ ${data.error || "上传失败"}`);
      }
    } catch {
      setMsg("❌ 网络错误");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-dashed rounded cursor-pointer hover:bg-gray-50">
        <input type="file" accept=".zip" onChange={handleUpload} className="hidden" />
        {uploading ? "上传中..." : "📦 上传 zip 安装插件"}
      </label>
      {msg && <span className="ml-2 text-xs">{msg}</span>}
    </div>
  );
}
