// 将旧逗号分隔标签迁移到 Tag + PostTag 多对多结构
// 在 /api/tags/route.ts 首次 GET 时自动调用（或手动触发）

import { prisma } from "@/lib/prisma";

let migrated = false;

export async function migrateTags(): Promise<{ migrated: number; tags: number }> {
  if (migrated) return { migrated: 0, tags: 0 };

  const posts = await prisma.post.findMany({
    where: { tags: { not: null } },
    select: { id: true, tags: true },
  });

  let migratedCount = 0;

  for (const post of posts) {
    if (!post.tags) continue;
    const tagNames = post.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagNames.length === 0) continue;

    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name, slug: name },
        update: {},
      });

      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: tag.id } },
        create: { postId: post.id, tagId: tag.id },
        update: {},
      });
    }
    migratedCount++;
  }

  // 重算所有 postCount
  const tags = await prisma.tag.findMany();
  for (const tag of tags) {
    const count = await prisma.postTag.count({ where: { tagId: tag.id } });
    if (count !== tag.postCount) {
      await prisma.tag.update({
        where: { id: tag.id },
        data: { postCount: count },
      });
    }
  }

  migrated = true;
  return { migrated: migratedCount, tags: tags.length };
}

// 手动重算所有标签的 postCount
export async function recountAllTags(): Promise<number> {
  const tags = await prisma.tag.findMany();
  for (const tag of tags) {
    const count = await prisma.postTag.count({ where: { tagId: tag.id } });
    if (count !== tag.postCount) {
      await prisma.tag.update({
        where: { id: tag.id },
        data: { postCount: count },
      });
    }
  }
  return tags.length;
}
