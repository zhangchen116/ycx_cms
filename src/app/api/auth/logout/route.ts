import { clearSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async () => {
  await clearSession();
  return NextResponse.json({ ok: true });
});
