import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPlugins } from "@/lib/plugin-loader";
import { list_placeholders } from "@/lib/placeholder-registry";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_TEMPLATE = path.join(process.cwd(), "public", "skill", "SKILL.md");

async function buildBaseUrl(): Promise<string> {
  const domain = (await prisma.setting.findUnique({ where: { key: "site.domain" } }))?.value || "localhost";
  const port = (await prisma.setting.findUnique({ where: { key: "site.port" } }))?.value;
  if (!port || port === "80") return "http://" + domain;
  return "http://" + domain + ":" + port;
}

async function generatePluginSection(): Promise<string> {
  await loadPlugins();
  const placeholders = list_placeholders();

  const slugs = [...new Set(placeholders.map((p) => p.plugin))];
  const plugins = await prisma.plugin.findMany({
    where: { slug: { in: slugs }, enabled: true },
  });

  // 补齐有 getSkillDocs 但没有占位符的插件
  const allPlugins = await prisma.plugin.findMany({ where: { enabled: true } });
  for (const p of allPlugins) {
    if (!slugs.includes(p.slug)) slugs.push(p.slug);
  }

  // 重新查询完整的插件列表
  const all = slugs.length > 0
    ? await prisma.plugin.findMany({ where: { slug: { in: slugs }, enabled: true } })
    : [];

  if (slugs.length === 0) return "";

  let section = "";

  // 插件占位符部分（仅当有占位符时输出）
  if (placeholders.length > 0) {
    section += "\n\n## 插件占位符\n\n";
    section += "你的站点启用了以下插件，可在页面 HTML 中使用对应的占位符：\n\n";

    for (const p of all) {
      const pPlaceholders = placeholders.filter((ph) => ph.plugin === p.slug);
      if (pPlaceholders.length === 0) continue;
      section += "### " + p.name + "\n\n";
      if (p.description) section += p.description + "\n\n";
      for (const ph of pPlaceholders) {
        if (ph.usage) {
          section += ph.usage + "\n\n";
        } else {
          section += '```html\n<div data-cms-plugin="' + ph.name + '"></div>\n```\n\n';
        }
      }
    }
  }

  // 插件 skill docs 部分（getSkillDocs 导出）
  let docsSection = "";
  for (const p of all) {
    try {
      const mod = await import(`@/lib/plugins/${p.slug}`);
      if (typeof mod.getSkillDocs === "function") {
        const docs = await mod.getSkillDocs();
        if (docs) {
          docsSection += "\n### " + p.name + "（外部 AI 工作流）\n\n" + docs + "\n";
        }
      }
    } catch {
      // 插件未实现 getSkillDocs 或加载失败，静默跳过
    }
  }

  if (docsSection) {
    section += "\n\n## 插件工作流与规则\n\n";
    section += "以下插件定义了外部 AI 需要遵循的特定工作流和数据规范：\n";
    section += docsSection;
  }

  return section;
}

async function generateSkillMarkdown(): Promise<string> {
  const template = await readFile(SKILL_TEMPLATE, "utf-8");
  // const pluginSection = await generatePluginSection();
  const baseUrl = await buildBaseUrl();

  let result = template.replace(/http:\/\/localhost:3000/g, baseUrl);

  // if (pluginSection) {
  //   const marker = "## 注意事项";
  //   const idx = result.indexOf(marker);
  //   if (idx !== -1) {
  //     result = result.slice(0, idx) + pluginSection + "\n" + result.slice(idx);
  //   } else {
  //     result += pluginSection;
  //   }
  // }

  // result += "\n\n## MCP 安装\n\n";
  // result += "解压后进入 mcp 目录安装依赖：\n\n";
  // result += "```bash\ncd mcp\nnpm install\n```\n\n";
  // result += "配置 OpenClaw MCP：\n\n";
  // result += "```json\n";
  // result += '{\n  "mcpServers": {\n    "cms": {\n      "command": "node",\n      "args": ["mcp/server.js"],\n      "env": {\n        "CMS_API_URL": "' + baseUrl + '",\n        "CMS_API_TOKEN": "your-token-here"\n      }\n    }\n  }\n';
  // result += "```\n";

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    const content = await generateSkillMarkdown();

    if (format === "zip") {
      const serverJs = await readFile(
        path.join(process.cwd(), "mcp", "server.js"),
        "utf-8",
      );
      const pkgJson = await readFile(
        path.join(process.cwd(), "mcp", "package.json"),
        "utf-8",
      );

      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip();
      zip.addFile("ycx-cms.md", Buffer.from(content, "utf-8"));
      zip.addFile("mcp/server.js", Buffer.from(serverJs, "utf-8"));
      zip.addFile("mcp/package.json", Buffer.from(pkgJson, "utf-8"));
      const buf = zip.toBuffer();

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="ycx-cms-skill.zip"',
        },
      });
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ycx-cms.md"',
      },
    });
  } catch (err) {
    console.error("Skill download error:", err);
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}
