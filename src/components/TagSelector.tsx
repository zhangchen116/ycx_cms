"use client";

import { useState, useEffect, useRef } from "react";

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TagSelector({ selectedIds, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((d) => setTags(d.tags));
  }, []);

  // 关闭下拉（点击外部）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = tags.filter((t) => selectedIds.includes(t.id));
  const unselected = tags.filter(
    (t) =>
      !selectedIds.includes(t.id) &&
      (query ? t.name.includes(query) : true),
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      const existing = tags.find(
        (t) => t.name === query.trim(),
      );
      if (existing) {
        if (!selectedIds.includes(existing.id)) {
          onChange([...selectedIds, existing.id]);
        }
        setQuery("");
      } else {
        // 快捷创建新标签
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: query.trim() }),
        });
        if (res.ok) {
          const newTag = await res.json();
          setTags((prev) => [...prev, newTag]);
          onChange([...selectedIds, newTag.id]);
        }
        setQuery("");
      }
    }
    if (e.key === "Backspace" && !query && selectedIds.length > 0) {
      onChange(selectedIds.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 已选标签 Chips + 输入框 */}
      <div
        className="flex flex-wrap gap-1 items-center border rounded px-2 py-1.5 min-h-[38px] cursor-text bg-white"
        onClick={() => setOpen(true)}
      >
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded"
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(tag.id); }}
              className="text-blue-400 hover:text-blue-700 ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "选择或输入标签..." : ""}
          className="border-none outline-none text-sm flex-1 min-w-[100px] py-0.5"
        />
      </div>

      {/* 下拉列表 */}
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {unselected.length === 0 && query && (
            <div className="px-3 py-2 text-sm text-gray-400">
              按回车创建 "{query}"
            </div>
          )}
          {unselected.length === 0 && !query && (
            <div className="px-3 py-2 text-sm text-gray-400">
              无更多标签
            </div>
          )}
          {unselected.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => { toggle(tag.id); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between items-center"
            >
              <span>{tag.name}</span>
              <span className="text-xs text-gray-400">{tag.postCount}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
