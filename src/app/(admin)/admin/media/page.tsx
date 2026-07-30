"use client";

import { useEffect, useState, useCallback } from "react";

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString("zh-CN");
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📄";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
}

function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

function isAudio(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

function isPreviewable(mimeType: string): boolean {
  return isImage(mimeType) || isVideo(mimeType) || isAudio(mimeType);
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const totalPages = Math.ceil(total / 20);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/media?page=${page}`);
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", files[0]);

    const res = await fetch("/api/media", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "上传失败");
    } else {
      await fetchItems();
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`删除 "${filename}"？`)) return;
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    await fetchItems();
  };

  const handleCopy = async (url: string, id: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const useHttps = process.env.USE_HTTPS === 'true';
    
    try {
      if (useHttps && navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      } else {
        window.prompt('请复制以下 URL：', fullUrl);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch (err) {
      console.error("复制失败:", err);
      alert('请手动复制 URL：\n' + fullUrl);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">资源媒体</h2>
        <label className="bg-blue-600 text-white px-4 py-2 rounded text-sm cursor-pointer hover:bg-blue-700">
          {uploading ? "上传中..." : "上传文件"}
          <input
            type="file"
            accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,audio/mp4,audio/webm,audio/opus"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-400 text-center py-20">暂无资源文件</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white border rounded-lg overflow-hidden group"
              >
                {/* Thumbnail */}
                <div
                  className={`aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden ${isPreviewable(item.mimeType) ? "cursor-pointer" : ""}`}
                  onClick={() => isPreviewable(item.mimeType) && setPreviewItem(item)}
                >
                  {isImage(item.mimeType) ? (
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo(item.mimeType) ? (
                    <div className="relative w-full h-full">
                      <video src={item.url} className="w-full h-full object-cover" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl drop-shadow-lg">▶️</span>
                      </div>
                    </div>
                  ) : isAudio(item.mimeType) ? (
                    <div className="flex flex-col items-center gap-2 p-4">
                      <span className="text-4xl">🎵</span>
                      <audio src={item.url} controls className="w-full" preload="metadata" />
                    </div>
                  ) : (
                    <span className="text-4xl">{getFileIcon(item.mimeType)}</span>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto">
                    {isPreviewable(item.mimeType) && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setPreviewItem(item); }}
                        className="bg-white/90 text-gray-700 px-3 py-1 rounded text-xs hover:bg-white"
                      >
                        {isImage(item.mimeType) ? "查看" : isVideo(item.mimeType) ? "播放" : "播放"}
                      </button>
                    )}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleCopy(item.url, item.id); }}
                      className="bg-white/90 text-gray-700 px-3 py-1 rounded text-xs hover:bg-white"
                    >
                      {copiedId === item.id ? "已复制 ✓" : "复制 URL"}
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleDelete(item.id, item.filename); }}
                      className="bg-red-500/90 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3 text-xs text-gray-500 space-y-0.5">
                  <div className="text-gray-700 truncate font-medium" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="flex justify-between">
                    <span>{formatSize(item.size)}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-sm border disabled:opacity-30"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded text-sm border disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox preview */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewItem(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none hover:text-gray-300 z-10"
            onClick={() => setPreviewItem(null)}
          >
            ✕
          </button>
          {isImage(previewItem.mimeType) && (
            <img
              src={previewItem.url}
              alt={previewItem.filename}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {isVideo(previewItem.mimeType) && (
            <video
              src={previewItem.url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {isAudio(previewItem.mimeType) && (
            <div
              className="bg-gray-900 rounded-xl p-8 min-w-[360px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <span className="text-5xl">🎵</span>
                <p className="text-white text-sm mt-2 truncate max-w-xs mx-auto">
                  {previewItem.filename}
                </p>
              </div>
              <audio src={previewItem.url} controls autoPlay className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}