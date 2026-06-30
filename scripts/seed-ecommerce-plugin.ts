import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  if (existing) {
    console.log("exists:", existing.id);
    await prisma.plugin.update({ where: { id: existing.id }, data: { enabled: true } });
    console.log("enabled");
  } else {
    const p = await prisma.plugin.create({
      data: {
        name: "电商插件",
        slug: "ecommerce",
        description: "轻量电商：商品管理、双通道购买（微信支付/外链）、售后闭环",
        version: "1.0.0",
        author: "代可行",
        enabled: true,
        config: { appId: "", mchId: "", serialNo: "", privateKeyPath: "", notifyUrl: "", apiV3Key: "", paymentEnabled: false },
        hooks: [{ hook: "admin_menu", type: "filter" }, { hook: "register_placeholders", type: "action" }, { hook: "wp_footer", type: "filter" }],
      },
    });
    console.log("created:", p.id);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
