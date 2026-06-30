"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Skill {
  name: string;
  description: string;
  path: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState("");

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to load");
      setSkills(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function handleInstall(e: React.FormEvent) {
    e.preventDefault();
    if (!gitUrl.trim()) return;
    setInstalling(true);
    setInstallMsg("");
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitUrl: gitUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstallMsg(`❌ ${data.error}`);
      } else {
        setInstallMsg(`✅ 已安装: ${data.name}`);
        setGitUrl("");
        fetchSkills();
      }
    } catch (e: any) {
      setInstallMsg(`❌ ${e.message}`);
    } finally {
      setInstalling(false);
    }
  }

  async function handleRemove(name: string) {
    if (!confirm(`确定要删除技能 "${name}"？`)) return;
    try {
      const res = await fetch("/api/skills", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) fetchSkills();
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">技能管理</h1>

      {/* Install Form */}
      <div className="bg-white rounded-lg border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">安装技能</h2>
        <form onSubmit={handleInstall} className="flex gap-3">
          <input
            type="text"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="Git 仓库地址，如 https://github.com/vercel-labs/agent-skills"
            className="flex-1 px-3 py-2 border rounded text-sm"
          />
          <button
            type="submit"
            disabled={installing || !gitUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
          >
            {installing ? "安装中..." : "安装"}
          </button>
        </form>
        {installMsg && <p className="mt-3 text-sm">{installMsg}</p>}
      </div>

      {/* Skills List */}
      <h2 className="text-lg font-semibold mb-4">已安装技能</h2>
      {loading ? (
        <p className="text-gray-400">加载中...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : skills.length === 0 ? (
        <p className="text-gray-400">暂无已安装的技能。输入上方的 Git 地址安装第一个技能。</p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="bg-white rounded-lg border p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-blue-700">{skill.name}</h3>
                {skill.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {skill.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/admin/skills/${encodeURIComponent(skill.name)}`}
                  className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                >
                  查看
                </Link>
                <button
                  onClick={() => handleRemove(skill.name)}
                  className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}