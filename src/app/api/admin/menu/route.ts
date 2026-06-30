import { NextResponse } from "next/server";
import { loadPlugins } from "@/lib/plugin-loader";
import { apply_filters } from "@/lib/hooks";

export async function GET() {
  await loadPlugins();
  const menuItems = await apply_filters("admin_menu", []);
  return NextResponse.json(Array.isArray(menuItems) ? menuItems : []);
}
