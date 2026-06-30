import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";
import { getSessionFromRequest } from "@/lib/auth";

export const GET = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [domain, port] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "site.domain" } }),
    prisma.setting.findUnique({ where: { key: "site.port" } }),
  ]);
  return NextResponse.json({
    domain: domain?.value || "",
    port: port?.value || "",
  });
});

export const PUT = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain, port } = await req.json();

  if (domain !== undefined) {
    await prisma.setting.upsert({
      where: { key: "site.domain" },
      update: { value: String(domain) },
      create: { key: "site.domain", value: String(domain) },
    });
  }
  if (port !== undefined) {
    await prisma.setting.upsert({
      where: { key: "site.port" },
      update: { value: String(port) },
      create: { key: "site.port", value: String(port) },
    });
  }

  return NextResponse.json({ ok: true });
});
