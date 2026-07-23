"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TagSelector from "@/components/TagSelector";

/** 从 content 中提取 body HTML，并去除与页面标题重复的 h1 */
function getContentHtml(content: string): string {
  if (!content) return "";
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : content;
  html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  return html;
}

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
  const [showPreview, setShowPreview] = useState(false);

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
            onClick={() => setShowPreview(true)}
            className="bg-white text-gray-600 px-4 py-2 rounded text-sm border hover:bg-gray-50"
          >
            👁 预览
          </button>
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

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 overflow-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 my-8 max-h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-lg">
              <span className="font-medium text-gray-700">预览：{post.title || "无标题"}</span>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto p-6">
              <article>
                <h1 className="text-3xl font-bold mb-3">{post.title || "无标题"}</h1>
                <div className="flex gap-3 text-sm text-gray-400 mb-6">
                  <span>{post.category?.name || "未分类"}</span>
                  <span>·</span>
                  <span>草稿</span>
                  {post.tags && (
                    <>
                      <span>·</span>
                      <span>{post.tags}</span>
                    </>
                  )}
                </div>
                <div
                  className="prose max-w-none"
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{ __html: getContentHtml(post.content) }}
                />
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
