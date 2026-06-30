"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function PluginAdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptsRef = useRef<string[]>([]);

  useEffect(() => {
    fetch(`/api/admin/plugin-page/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const html = data.content || "";
        const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        const extracted: string[] = [];
        const cleanHtml = html.replace(scriptPattern, (_match: string, code: string) => {
          extracted.push(code.trim());
          return "";
        });
        scriptsRef.current = extracted;
        setContent(cleanHtml);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!scriptsRef.current.length) return;
    scriptsRef.current.forEach((code) => {
      if (!code) return;
      try { new Function(code)(); } catch (e) { console.error("[plugin-admin] script error:", e); }
    });
    scriptsRef.current = [];
  }, [content]);

  if (loading) return <div className="text-gray-400 text-sm">加载中...</div>;
  if (!content) return <div className="text-gray-400 text-sm">暂无内容</div>;

  return <div ref={containerRef} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: content }} />;
}
