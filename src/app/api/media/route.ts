import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";
import { withLogging } from "@/lib/api-logger";

const UPLOAD_DIR = join(process.cwd(), "uploads");

export const GET = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.media.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.media.count(),
  ]);

  return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

export const POST = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Validate file type
  const allowedTypes = [
    // 图片
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/avif",
    // 视频
    "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    // 音频
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/webm", "audio/opus",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }

  // Validate size (200MB max)
  const maxSize = 200 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 200MB)" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = file.name.split(".").pop() || "bin";
  const uniqueName = crypto.randomBytes(12).toString("hex") + "." + ext;
  const url = "/uploads/" + uniqueName;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, uniqueName), buffer);

  const media = await prisma.media.create({
    data: {
      filename: file.name,
      url,
      mimeType: file.type,
      size: file.size,
    },
  });

  return NextResponse.json(media, { status: 201 });
});
