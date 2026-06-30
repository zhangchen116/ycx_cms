import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async () => {
  let config = await prisma.siteLanguage.findFirst();
  if (!config) {
    config = await prisma.siteLanguage.create({
      data: {
        defaultLocale: "zh-CN",
        enabledLocales: ["zh-CN"],
      },
    });
  }
  return NextResponse.json(config);
});

export const PUT = withLogging(async (req: Request) => {
  const body = await req.json();
  let config = await prisma.siteLanguage.findFirst();

  if (config) {
    config = await prisma.siteLanguage.update({
      where: { id: config.id },
      data: {
        defaultLocale: body.defaultLocale,
        enabledLocales: body.enabledLocales,
      },
    });
  } else {
    config = await prisma.siteLanguage.create({
      data: {
        defaultLocale: body.defaultLocale || "zh-CN",
        enabledLocales: body.enabledLocales || ["zh-CN"],
      },
    });
  }

  return NextResponse.json(config);
});
