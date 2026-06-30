import { NextResponse } from "next/server";
import { loadPlugins } from "@/lib/plugin-loader";
import { apply_filters } from "@/lib/hooks";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  await loadPlugins();
  const content = await apply_filters(`admin_page_${slug}`, "");
  return NextResponse.json({ content });
}
