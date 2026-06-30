import { readdir, readFile, mkdir, rm, writeFile } from "fs/promises";
import { join, basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const SKILLS_DIR = join(process.cwd(), "data", "skills");

export interface SkillMeta {
  name: string;
  description: string;
  path: string;
}

function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };
  const frontmatter: Record<string, string> = {};
  match[1].split("\n").forEach((line) => {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  });
  return { data: frontmatter, body: match[2] };
}

export async function listSkills(): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = [];
  try {
    const dirs = await readdir(SKILLS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const skillPath = join(SKILLS_DIR, d.name);
      try {
        const content = await readFile(join(skillPath, "SKILL.md"), "utf-8");
        const { data } = parseFrontmatter(content);
        skills.push({
          name: data.name || d.name,
          description: data.description || "",
          path: skillPath,
        });
      } catch {
        // skip dirs without valid SKILL.md
      }
    }
  } catch {
    // skills dir doesn't exist
  }
  return skills;
}

export async function getSkill(name: string): Promise<{ meta: SkillMeta; body: string } | null> {
  const skillPath = join(SKILLS_DIR, name);
  try {
    const content = await readFile(join(skillPath, "SKILL.md"), "utf-8");
    const { data, body } = parseFrontmatter(content);
    return {
      meta: {
        name: data.name || name,
        description: data.description || "",
        path: skillPath,
      },
      body,
    };
  } catch {
    return null;
  }
}

export async function installSkill(gitUrl: string): Promise<SkillMeta | { error: string }> {
  const tmpDir = join(SKILLS_DIR, ".tmp-" + Date.now());
  try {
    await mkdir(SKILLS_DIR, { recursive: true });

    // Clone repo
    await execAsync(`git clone --depth 1 "${gitUrl}" "${tmpDir}"`, {
      timeout: 60_000,
    });

    // Find SKILL.md files in cloned repo
    const { stdout } = await execAsync(
      `find "${tmpDir}" -name "SKILL.md" -not -path "*/node_modules/*"`,
      { timeout: 10_000 }
    );
    const skillFiles = stdout.trim().split("\n").filter(Boolean);

    if (skillFiles.length === 0) {
      await rm(tmpDir, { recursive: true, force: true });
      return { error: "No SKILL.md files found in repository" };
    }

    const installed: SkillMeta[] = [];
    for (const skillFile of skillFiles) {
      const content = await readFile(skillFile, "utf-8");
      const { data } = parseFrontmatter(content);
      const skillName = data.name || basename(join(skillFile, ".."));
      const targetDir = join(SKILLS_DIR, skillName);

      // Copy skill directory (the parent of SKILL.md)
      const skillDir = join(skillFile, "..");
      await execAsync(`cp -r "${skillDir}" "${targetDir}"`, { timeout: 10_000 });

      installed.push({
        name: skillName,
        description: data.description || "",
        path: targetDir,
      });
    }

    await rm(tmpDir, { recursive: true, force: true });
    return installed[0]; // Return first installed skill
  } catch (e: any) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return { error: e.message || "Failed to install skill" };
  }
}

export async function removeSkill(name: string): Promise<boolean> {
  try {
    await rm(join(SKILLS_DIR, name), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function createSkill(
  name: string,
  description: string,
  body: string
): Promise<SkillMeta> {
  await mkdir(SKILLS_DIR, { recursive: true });
  const skillDir = join(SKILLS_DIR, name);
  await mkdir(skillDir, { recursive: true });

  const content = `---
name: ${name}
description: ${description}
---

${body}`;

  await writeFile(join(skillDir, "SKILL.md"), content);
  return { name, description, path: skillDir };
}

export async function updateSkill(
  name: string,
  description: string,
  body: string
): Promise<SkillMeta | null> {
  const skillDir = join(SKILLS_DIR, name);
  try {
    const content = `---
name: ${name}
description: ${description}
---

${body}`;
    await writeFile(join(skillDir, "SKILL.md"), content);
    return { name, description, path: skillDir };
  } catch {
    return null;
  }
}