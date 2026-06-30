// src/lib/placeholder-docs.ts
import { prisma } from "@/lib/prisma";
import { loadPlugins } from "@/lib/plugin-loader";
import { list_placeholders } from "@/lib/placeholder-registry";

/**
  * 生成所有已启用插件的占位符使用规则文档（Markdown 字符串）
  * 包含两部分：
  *   1. 插件占位符说明（来自 list_placeholders 的 usage 字段）
  *   2. 插件工作流文档（来自插件模块的 getSkillDocs 导出）
  */
export async function generatePlaceholderDocs(): Promise<string> {
    await loadPlugins();
    const placeholders = list_placeholders();

    // 收集所有需要处理的插件 slug
    const slugs = new Set<string>();
    placeholders.forEach((p) => slugs.add(p.plugin));

    // 补齐有 getSkillDocs 但没有占位符的插件
    const allEnabled = await prisma.plugin.findMany({ where: { enabled: true } });
    allEnabled.forEach((p) => slugs.add(p.slug));

    if (slugs.size === 0) {
        return "当前没有已启用的插件。";
    }

    const plugins = await prisma.plugin.findMany({
        where: { slug: { in: [...slugs] }, enabled: true },
    });

    let section = "";

    // ── 第一部分：插件占位符说明 ──
    if (placeholders.length > 0) {
        section += "## 插件占位符\n\n";
        section += "你的站点启用了以下插件，可在页面 HTML 中使用对应的占位符：\n\n";

        for (const p of plugins) {
            const pPlaceholders = placeholders.filter((ph) => ph.plugin === p.slug);
            if (pPlaceholders.length === 0) continue;

            section += `### ${p.name}\n\n`;
            if (p.description) section += `${p.description}\n\n`;

            for (const ph of pPlaceholders) {
                if (ph.usage) {
                    section += `${ph.usage}\n\n`;
                } else {
                    section += `\`\`\`html\n<div data-cms-plugin="${ph.name}"></div>\n\`\`\`\n\n`;
                }
            }
        }
    }

    // ── 第二部分：插件工作流文档 ──
    let docsSection = "";
    for (const p of plugins) {
        try {
            const mod = await import(`@/lib/plugins/${p.slug}`);
            if (typeof mod.getSkillDocs === "function") {
                const docs = await mod.getSkillDocs();
                if (docs) {
                    docsSection += `\n### ${p.name}（外部 AI 工作流）\n\n${docs}\n`;
                }
            }
        } catch {
            // 插件未实现 getSkillDocs 或加载失败，静默跳过
        }
    }

    if (docsSection) {
        section += "\n## 插件工作流与规则\n\n";
        section += "以下插件定义了外部 AI 需要遵循的特定工作流和数据规范：\n";
        section += docsSection;
    }

    return section.trim();
}
