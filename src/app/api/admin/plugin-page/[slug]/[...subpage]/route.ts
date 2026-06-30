import { NextResponse } from "next/server";
import { loadPlugins } from "@/lib/plugin-loader";
import { apply_filters } from "@/lib/hooks";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; subpage: string[] }> },
) {
  const { slug, subpage } = await params;
  await loadPlugins();

  const subpageKey = subpage.join("/");
  const content = await apply_filters(`admin_subpage_${slug}_${subpageKey}`, "");

  return NextResponse.json({ content });
}
