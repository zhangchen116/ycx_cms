import { getSessionFromRequest, getAuthErrorResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";
import { recountAllTags } from "@/lib/migrate-tags";

// POST /api/tags/recount — 重算所有标签的 postCount
export const POST = withLogging(async (req: Request) => {
  const session = await getSessionFromRequest(req);
  if (!session) return getAuthErrorResponse();

  const count = await recountAllTags();
  return NextResponse.json({ ok: true, count });
});
