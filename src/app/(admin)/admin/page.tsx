"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    categoryCount: number;
    postCount: number;
    publishedCount: number;
    recentPosts: Array<{ id: string; title: string; status: string; createdAt: string }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return <div className="text-gray-500">加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-3xl font-bold text-blue-600">{stats.categoryCount}</div>
          <div className="text-sm text-gray-500 mt-1">分类数</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-3xl font-bold text-green-600">{stats.publishedCount}</div>
          <div className="text-sm text-gray-500 mt-1">已发布帖子</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-3xl font-bold text-purple-600">{stats.postCount}</div>
          <div className="text-sm text-gray-500 mt-1">帖子总数</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">最近帖子</h2>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">标题</th>
              <th className="text-left px-4 py-2">状态</th>
              <th className="text-left px-4 py-2">时间</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentPosts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  <Link href={`/admin/posts/${p.id}`} className="text-blue-600 hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {p.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                </td>
              </tr>
            ))}
            {stats.recentPosts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  暂无帖子
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
