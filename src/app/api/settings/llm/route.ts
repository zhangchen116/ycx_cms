import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: Request) => {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: "llm." } },
  });
  const map: Record<string, string> = {};
  settings.forEach((s) => (map[s.key] = s.value));
  return NextResponse.json(map);
});

const llmSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export const PUT = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = llmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
    for (const [k, v] of entries) {
      await prisma.setting.upsert({
        where: { key: `llm.${k}` },
        update: { value: v as string },
        create: { key: `llm.${k}`, value: v as string },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
});
