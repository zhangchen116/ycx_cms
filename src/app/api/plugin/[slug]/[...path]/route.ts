import { NextRequest, NextResponse } from "next/server";
import { loadPlugins, findPluginApiHandler } from "@/lib/plugin-loader";

async function handle(
  req: NextRequest,
  method: string,
  slug: string,
  pathSegments: string[],
) {
  await loadPlugins();

  const routePath = "/" + pathSegments.join("/");
  const handler = findPluginApiHandler(slug, method, routePath);

  if (!handler) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return await handler(req, pathSegments);
  } catch (err) {
    console.error(`[Plugin API] ${slug} ${method} ${routePath} 错误:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  return handle(req, "GET", slug, path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  return handle(req, "POST", slug, path);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  return handle(req, "PUT", slug, path);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  return handle(req, "PATCH", slug, path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  return handle(req, "DELETE", slug, path);
}
