import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  // 图片
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff", tif: "image/tiff",
  avif: "image/avif",
  // 视频
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  // 音频
  mp3: "audio/mpeg",
  wav: "audio/wav",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
  wma: "audio/x-ms-wma",
  weba: "audio/webm",
  opus: "audio/opus",
  mid: "audio/midi", midi: "audio/midi",
  // 文档
  pdf: "application/pdf",
};

// 一年缓存，带 immutable 标记，适配 CDN
const CACHE_HEADER = "public, max-age=31536000, immutable";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filename = path.join("/");

  // 防路径穿越
  if (filename.includes("..") || filename.startsWith("/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = join(UPLOAD_DIR, filename);

  if (!existsSync(filePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mimeType = MIME_MAP[ext] || "application/octet-stream";

  // 弱 ETag：用 mtime
  const { stat } = await import("fs/promises");
  const stats = await stat(filePath);
  const etag = `"${stats.mtimeMs.toString(36)}-${stats.size.toString(36)}"`;

  // 304 协商缓存
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": CACHE_HEADER,
        ETag: etag,
      },
    });
  }

  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stats.size),
      "Cache-Control": CACHE_HEADER,
      ETag: etag,
      // Accept-Ranges 支持 Range 请求（视频拖动播放需要）
      "Accept-Ranges": "bytes",
    },
  });
}
