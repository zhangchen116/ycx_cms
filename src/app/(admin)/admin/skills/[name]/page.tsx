"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface SkillDetail {
  meta: { name: string; description: string; path: string };
  body: string;
}

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const router = useRouter();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/skills/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setSkill(data);
          setDesc(data.meta.description);
          setBody(data.body);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [name]);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${data.error}`);
      } else {
        setSkill(data as any);
        setEditing(false);
        setMsg("✅ 已保存");
      }
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除此技能？")) return;
    await fetch(`/api/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
    router.push("/admin/skills");
  }

  if (loading) return <div className="max-w-3xl mx-auto p-6">加载中...</div>;
  if (error)
    return <div className="max-w-3xl mx-auto p-6 text-red-500">{error}</div>;
  if (!skill) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{skill.meta.name}</h1>
        <div className="flex gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              编辑
            </button>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>

      {msg && <p className="mb-4 text-sm">{msg}</p>}

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              placeholder="一句话描述此技能"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">正文 (Markdown)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
              placeholder="# Skill Content..."
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-6">
          {skill.meta.description && (
            <p className="text-gray-500 mb-4">{skill.meta.description}</p>
          )}
          <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
            {skill.body}
          </pre>
        </div>
      )}
    </div>
  );
}