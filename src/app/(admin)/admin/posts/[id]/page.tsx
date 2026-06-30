"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TagSelector from "@/components/TagSelector";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  categoryId: string;
  tags: string;
  tagIds: string[];
  status: string;
  category: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
}

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/posts/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([p, cats]) => {
      setPost(p);
      setCategories(cats);
    });
  }, [id]);

  const handleSave = async (status?: string) => {
    if (!post) return;
    setSaving(true);
    await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...post, status: status || post.status }),
    });
    setSaving(false);
  };

  if (!post) return <div className="text-gray-500">加载中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:underline text-sm">← 返回</button>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave("DRAFT")}
            disabled={saving}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200"
          >
            保存草稿
          </button>
          <button
            onClick={() => handleSave("PUBLISHED")}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            发布
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          <input
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
            placeholder="标题"
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <select
            value={post.categoryId}
            onChange={(e) => setPost({ ...post, categoryId: e.target.value })}
            className="border rounded px-3 py-2 text-sm w-48"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={post.status}
            onChange={(e) => setPost({ ...post, status: e.target.value })}
            className="border rounded px-3 py-2 text-sm w-28"
          >
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
          </select>
        </div>

        <input
          value={post.slug}
          onChange={(e) => setPost({ ...post, slug: e.target.value })}
          placeholder="URL 标识"
          className="w-full border rounded px-3 py-2 text-sm"
        />

        <textarea
          value={post.content}
          onChange={(e) => setPost({ ...post, content: e.target.value })}
          placeholder="正文（Markdown）"
          className="w-full border rounded px-3 py-2 text-sm font-mono"
          rows={20}
        />

        <TagSelector
          selectedIds={post.tagIds || []}
          onChange={(ids) => setPost({ ...post, tagIds: ids })}
        />
      </div>
    </div>
  );
}
