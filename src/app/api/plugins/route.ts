import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plugins = await prisma.plugin.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(plugins);
});

const updateSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PUT = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { id, enabled, config } = parsed.data;
    const data: Record<string, unknown> = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (config !== undefined) data.config = config;

    const plugin = await prisma.plugin.update({ where: { id }, data });
    return NextResponse.json(plugin);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "更新失败" }, { status: 500 });
  }
});
