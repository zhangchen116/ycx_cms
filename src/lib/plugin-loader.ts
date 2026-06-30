import { prisma } from "@/lib/prisma";
import { do_action } from "@/lib/hooks";
import fs from "fs";
import path from "path";
import type { NextRequest, NextResponse } from "next/server";

let loaded = false;

// ──── v4: API 路由注册表 ────

type PluginApiHandler = (
  req: NextRequest,
  pathSegments: string[],
) => Promise<NextResponse> | NextResponse;

const pluginApiRoutes = new Map<string, PluginApiHandler>();

/** 插件注册 API 路由 handler */
export function registerPluginApiRoute(
  pluginSlug: string,
  method: string,
  routePath: string,
  handler: PluginApiHandler,
) {
  pluginApiRoutes.set(`${pluginSlug}:${method}:${routePath}`, handler);
}

/** 查询已注册的插件 API handler。先精确匹配，再 fallback 通配符 */
export function findPluginApiHandler(
  pluginSlug: string,
  method: string,
  routePath: string,
): PluginApiHandler | undefined {
  return (
    pluginApiRoutes.get(`${pluginSlug}:${method}:${routePath}`) ??
    pluginApiRoutes.get(`${pluginSlug}:${method}:*`)
  );
}

// ──── v4: 插件数据模型初始化 ────

/** 读取插件目录下的 schema.json，执行 CREATE TABLE 等语句 */
async function initPluginSchema(pluginSlug: string) {
  const schemaPath = path.join(
    process.cwd(),
    "src/lib/plugins",
    pluginSlug,
    "schema.json",
  );
  if (!fs.existsSync(schemaPath)) return;

  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    const statements: string[] = schema.statements ?? [];
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
    console.log(`[Plugin] ${pluginSlug} schema 初始化完成 (${statements.length} 条语句)`);
  } catch (err) {
    console.error(`[Plugin] ${pluginSlug} schema 初始化失败:`, err);
  }
}

// ──── 插件加载入口 ────

/** 加载所有已启用插件，触发 register_placeholders */
export async function loadPlugins() {
  if (loaded) return;
  loaded = true;

  const plugins = await prisma.plugin.findMany({ where: { enabled: true } });

  for (const p of plugins) {
    // v4: 先建表，再加载逻辑
    await initPluginSchema(p.slug);

    const config = (p.config as Record<string, unknown>) || {};
    try {
      const mod = await import(`@/lib/plugins/${p.slug}`);
      if (typeof mod.default === "function") {
        await mod.default(config);
      }
    } catch (err) {
      console.error(`[Plugin] 加载 ${p.slug} 失败:`, err);
    }
  }

  // 所有插件注册完成后，统一触发占位符注册
  await do_action("register_placeholders");
}
