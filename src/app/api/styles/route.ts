import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async () => {
  const styles = await prisma.style.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(styles);
});
