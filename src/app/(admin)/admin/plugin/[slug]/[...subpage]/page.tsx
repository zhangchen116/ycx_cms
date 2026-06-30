"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function PluginAdminSubPage() {
  const params = useParams<{ slug: string; subpage: string[] }>();
  const slug = params.slug;
  const subpage = Array.isArray(params.subpage)
    ? params.subpage.join("/")
    : params.subpage;
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptsRef = useRef<string[]>([]);

  useEffect(() => {
    fetch(`/api/admin/plugin-page/${slug}/${subpage}`)
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
  }, [slug, subpage]);

  useEffect(() => {
    if (!scriptsRef.current.length) return;
    scriptsRef.current.forEach((code) => {
      if (!code) return;
      const scriptEl = document.createElement("script");
      scriptEl.textContent = code;
      document.head.appendChild(scriptEl);
    });
    scriptsRef.current = [];
  }, [content]);

  if (loading) return <div className="text-gray-400 text-sm">加载中...</div>;
  if (!content) return <div className="text-gray-400 text-sm">暂无内容</div>;

  return <div ref={containerRef} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: content }} />;
}
