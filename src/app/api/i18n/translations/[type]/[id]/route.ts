import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ type: string; id: string }> }
  ) => {
  const { type, id } = await params;
  const translations = await prisma.translation.findMany({
    where: { translatableType: type, translatableId: id },
    orderBy: { locale: "asc" },
  });
  return NextResponse.json(translations);
});

export const PUT = withLogging(
  async (
    req: Request,
    { params }: { params: Promise<{ type: string; id: string }> }
  ) => {
  const { type, id } = await params;
  const body = await req.json();

  const translation = await prisma.translation.upsert({
    where: {
      translatableType_translatableId_locale: {
        translatableType: type,
        translatableId: id,
        locale: body.locale,
      },
    },
    update: {
      title: body.title,
      content: body.content,
      excerpt: body.excerpt,
    },
    create: {
      translatableType: type,
      translatableId: id,
      locale: body.locale,
      title: body.title,
      content: body.content,
      excerpt: body.excerpt,
    },
  });

  return NextResponse.json(translation);
});
