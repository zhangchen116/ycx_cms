import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import AdmZip from "adm-zip";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getSessionFromRequest } from "@/lib/auth";

const PLUGINS_DIR = path.join(process.cwd(), "src", "lib", "plugins");

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let slug = (formData.get("slug") as string) || "";

    if (!file && !slug) {
      return NextResponse.json({ error: "缺少 zip 文件" }, { status: 400 });
    }

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      // 从 zip 根目录推断 slug
      if (!slug) {
        const rootEntries = entries.filter((e) => !e.isDirectory && !e.entryName.includes("/"));
        if (rootEntries.length === 0) {
          // 有目录层级，取第一级目录名
          const dirMatch = entries.find((e) => e.entryName.includes("/"));
          if (dirMatch) {
            slug = dirMatch.entryName.split("/")[0];
          }
        } else {
          // 用文件名（去掉 .zip 后缀）
          slug = (file.name || "plugin").replace(/\.zip$/i, "");
        }
      }

      slug = slug.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
      if (!slug) {
        return NextResponse.json({ error: "无法识别插件标识" }, { status: 400 });
      }

      const destDir = path.join(PLUGINS_DIR, slug);

      // 提取 zip
      zip.extractAllTo(PLUGINS_DIR, true);

      // 如果所有文件散落在 plugins/ 根目录，移到子目录
      const topFiles = entries.filter(
        (e) => !e.isDirectory && !e.entryName.includes("/"),
      );
      if (topFiles.length > 0 && topFiles.length === entries.length) {
        // 扁平结构 → 移到子目录
        await mkdir(destDir, { recursive: true });
        for (const entry of topFiles) {
          const content = entry.getData();
          await writeFile(path.join(destDir, path.basename(entry.entryName)), content);
        }
        // 清理散落在根目录的文件
        for (const entry of topFiles) {
          const flatPath = path.join(PLUGINS_DIR, path.basename(entry.entryName));
          try { await rm(flatPath); } catch {}
        }
      }

      // 如果是单层目录 zip，提取出来可能是 plugins/xxx/...，需要移到 plugins/ 下
      const firstDir = entries.find((e) => e.isDirectory && e.entryName.split("/").filter(Boolean).length === 1);
      if (firstDir) {
        const extractedSlug = firstDir.entryName.split("/")[0];
        if (extractedSlug !== slug) {
          // 重命名
          const srcDir = path.join(PLUGINS_DIR, extractedSlug);
          const destDir2 = path.join(PLUGINS_DIR, slug);
          if (existsSync(srcDir) && !existsSync(destDir2)) {
            await mkdir(destDir, { recursive: true });
            // move files
            const { readdir, rename } = await import("node:fs/promises");
            const files = await readdir(srcDir);
            for (const f of files) {
              await rename(path.join(srcDir, f), path.join(destDir2, f));
            }
            try { await rm(srcDir, { recursive: true }); } catch {}
          }
        }
      }
    }

    // 读取 plugin.json 获取元数据
    const configPath = path.join(PLUGINS_DIR, slug, "plugin.json");
    let meta: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        meta = JSON.parse(await readFile(configPath, "utf-8"));
      } catch {}
    }

    // 检查 index.ts 是否存在
    const hasIndex = existsSync(path.join(PLUGINS_DIR, slug, "index.ts"));
    if (!hasIndex && !file) {
      return NextResponse.json({ error: `找不到插件目录: ${slug}` }, { status: 400 });
    }

    // Upsert 数据库记录
    const plugin = await prisma.plugin.upsert({
      where: { slug },
      update: {
        name: (meta.name as string) || slug,
        description: (meta.description as string) || "",
        version: (meta.version as string) || "1.0.0",
        author: (meta.author as string) || "",
        hooks: (meta.hooks as unknown) ?? undefined,
        config: (meta.config as unknown) ?? undefined,
      },
      create: {
        slug,
        name: (meta.name as string) || slug,
        description: (meta.description as string) || "",
        version: (meta.version as string) || "1.0.0",
        author: (meta.author as string) || "",
        enabled: true,
        hooks: (meta.hooks as unknown) ?? undefined,
        config: (meta.config as unknown) ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, plugin });
  } catch (err) {
    console.error("Plugin upload error:", err);
    return NextResponse.json({ error: "上传失败: " + String(err) }, { status: 500 });
  }
}
