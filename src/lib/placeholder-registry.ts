import { prisma } from "@/lib/prisma";
import type { RenderContext } from "@/lib/page-renderer";

export type PlaceholderRenderer = (
  attrs: Record<string, string>,
  config: Record<string, unknown>,
  context: { siteSettings: Record<string, string>; page?: RenderContext["page"] },
) => string | Promise<string>;

interface RegistryEntry {
  render: PlaceholderRenderer;
  plugin: string;
  usage: string;
}

const registry = new Map<string, RegistryEntry>();

/** 注册一个占位符。usage 为 Markdown 格式的使用说明，必填。 */
export function register_placeholder(
  name: string,
  renderer: PlaceholderRenderer,
  pluginSlug: string,
  usage: string,
) {
  registry.set(name, { render: renderer, plugin: pluginSlug, usage });
}

/** 获取占位符渲染器（校验插件是否启用） */
export async function get_placeholder_renderer(
  name: string,
): Promise<{ render: PlaceholderRenderer; config: Record<string, unknown> } | null> {
  const entry = registry.get(name);
  if (!entry) return null;
  const plugin = await prisma.plugin.findUnique({ where: { slug: entry.plugin } });
  if (!plugin?.enabled) return null;
  return {
    render: entry.render,
    config: (plugin.config as Record<string, unknown>) || {},
  };
}

/** 获取所有已注册占位符（给 AI schema 和 SKILL.md 生成用） */
export function list_placeholders(): { name: string; plugin: string; usage: string }[] {
  return [...registry.entries()].map(([name, entry]) => ({ name, plugin: entry.plugin, usage: entry.usage }));
}
