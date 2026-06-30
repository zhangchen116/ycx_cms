import { NextRequest, NextResponse } from "next/server";
import { getSkill, updateSkill, removeSkill } from "@/lib/skills";
import { getSessionFromRequest } from "@/lib/auth";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const skill = await getSkill(name);
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(skill);
});

export const PUT = withLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const { description, body } = await req.json();
  const result = await updateSkill(name, description, body);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
});

export const DELETE = withLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
  ) => {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const ok = await removeSkill(name);
  if (!ok) return NextResponse.json({ error: "Failed" }, { status: 400 });
  return NextResponse.json({ success: true });
});