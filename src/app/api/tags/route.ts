import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";
import { migrateTags } from "@/lib/migrate-tags";

const createTagSchema = z.object({
  name: z.string().min(1, "标签名不能为空").max(50),
});

// GET /api/tags — 标签列表（首次调用自动迁移旧逗号标签）
export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  await migrateTags();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const orderBy = searchParams.get("orderBy") || "postCount";
  const order = searchParams.get("order") || "desc";

  const where = q ? { name: { contains: q } } : {};
  const tags = await prisma.tag.findMany({
    where,
    orderBy: { [orderBy]: order },
  });

  return NextResponse.json({ tags });
});

// POST /api/tags — 创建标签（已存在则幂等返回）
export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  try {
    const body = await req.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { name } = parsed.data;
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) return NextResponse.json(existing);

    const tag = await prisma.tag.create({
      data: { name, slug: name },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "标签名已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: `创建失败: ${err?.message}` }, { status: 500 });
  }
});
