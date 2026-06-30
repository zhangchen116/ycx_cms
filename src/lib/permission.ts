import { getSession } from "./auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR";

// Who can do what
const PERMISSIONS: Record<string, Role[]> = {
  "users:create": ["SUPER_ADMIN"],
  "users:delete": ["SUPER_ADMIN"],
  "users:list": ["SUPER_ADMIN"],
  "users:edit": ["SUPER_ADMIN"],
  "categories:mutate": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "pages:mutate": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "pages:delete": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "posts:mutate": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "posts:delete": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "posts:ai": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "pages:ai": ["SUPER_ADMIN", "ADMIN", "EDITOR"],
  "styles:mutate": ["SUPER_ADMIN", "ADMIN"],
  "settings:mutate": ["SUPER_ADMIN", "ADMIN"],
  "versions:rollback": ["SUPER_ADMIN", "ADMIN"],
  "i18n:mutate": ["SUPER_ADMIN", "ADMIN"],
  "plugins:mutate": ["SUPER_ADMIN", "ADMIN"],
};

export function hasPermission(role: Role, action: string): boolean {
  const allowed = PERMISSIONS[action];
  return allowed ? allowed.includes(role) : false;
}

export async function requireAuth(
  req: NextRequest,
  action: string
): Promise<NextResponse | null> {
  const res = NextResponse.next();
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.role as Role, action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // OK
}
