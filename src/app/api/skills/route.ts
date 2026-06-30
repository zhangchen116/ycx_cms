import { NextRequest, NextResponse } from "next/server";
import { listSkills, installSkill, removeSkill } from "@/lib/skills";
import { getSessionFromRequest } from "@/lib/auth";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const skills = await listSkills();
  return NextResponse.json(skills);
});

export const POST = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gitUrl } = await req.json();
  if (!gitUrl) return NextResponse.json({ error: "gitUrl required" }, { status: 400 });

  const result = await installSkill(gitUrl);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
});

export const DELETE = withLogging(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const ok = await removeSkill(name);
  if (!ok) return NextResponse.json({ error: "Failed to remove skill" }, { status: 400 });
  return NextResponse.json({ success: true });
});