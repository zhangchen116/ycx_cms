"use client";

import { useEffect, useState } from "react";

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  const fetchTags = () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    setLoading(true);
    fetch(`/api/tags?${params}`)
      .then((r) => r.json())
      .then((data) => { setTags(data.tags); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewName("");
      fetchTags();
    } else {
      const data = await res.json();
      setError(data.error || "创建失败");
    }
  };

  const handleRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) { setEditingId(null); return; }
    const res = await fetch(`/api/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchTags();
    } else {
      const data = await res.json();
      setError(data.error || "重命名失败");
    }
  };

  const handleDelete = async (tag: Tag) => {
    const msg = tag.postCount > 0
      ? `确定删除"${tag.name}"？已关联 ${tag.postCount} 个帖子。`
      : `确定删除"${tag.name}"？`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    if (res.ok) fetchTags();
  };

  const handleRecount = async () => {
    await fetch("/api/tags/recount", { method: "POST" });
    fetchTags();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">标签管理</h1>
        <button
          onClick={handleRecount}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          重新计算引用数
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* 新建 */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="输入标签名，回车创建"
          className="flex-1 border rounded px-3 py-2 text-sm"
          maxLength={50}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          新建
        </button>
      </form>

      {/* 搜索 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchTags()}
          placeholder="搜索标签..."
          className="border rounded px-3 py-1.5 text-sm w-64"
        />
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">名称</th>
              <th className="text-left px-4 py-2">Slug</th>
              <th className="text-center px-4 py-2">引用数</th>
              <th className="text-left px-4 py-2">创建时间</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  {editingId === tag.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(tag.id)}
                      onBlur={() => setEditingId(null)}
                      className="border rounded px-2 py-0.5 text-sm w-32"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium">{tag.name}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">{tag.slug}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${tag.postCount > 0 ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"}`}>
                    {tag.postCount}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(tag.createdAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    重命名
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {tags.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {search ? "无匹配标签" : "暂无标签，在上方创建第一个"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
