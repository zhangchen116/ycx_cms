import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { q, qOne, exec, camelKeys, genOutTradeNo, cuid } from "../lib/db";
import { getAdapter, type CreateOrderParams, type PayType } from "../payment/adapter";

type ApiHandler = (req: NextRequest, segs: string[]) => Promise<NextResponse>;

function authErr() { return NextResponse.json({ error: "未登录" }, { status: 401 }); }

// ──── Config ────

export const getConfig: ApiHandler = async () => {
  const { prisma } = await import("@/lib/prisma");
  const plugin = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  const config = (plugin?.config as Record<string, unknown>) || {};
  return NextResponse.json({
    provider: config.provider || "wechat",
    appId: config.appId || "",
    mchId: config.mchId || "",
    serialNo: config.serialNo || "",
    privateKeyPath: config.privateKeyPath ? "***已设置***" : "",
    notifyUrl: config.notifyUrl || "",
    enabled: config.paymentEnabled || false,
  });
};

export const updateConfig: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { prisma } = await import("@/lib/prisma");
  const plugin = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  if (!plugin) return NextResponse.json({ error: "插件未安装" }, { status: 404 });

  const config = (plugin.config as Record<string, unknown>) || {};
  for (const key of ["appId", "mchId", "serialNo", "privateKeyPath", "notifyUrl", "provider"]) {
    if (body[key] !== undefined) config[key] = body[key];
  }
  if (body.paymentEnabled !== undefined) config.paymentEnabled = body.paymentEnabled;
  if (body.apiV3Key) config.apiV3Key = body.apiV3Key;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.plugin.update({ where: { id: plugin.id }, data: { config: config as any } });
  return NextResponse.json({ ok: true });
};

// ──── 统一下单（通过适配层） ────

export const unifiedOrder: ApiHandler = async (req) => {
  const body = await req.json();
  const { orderType, orderId, payType } = body;

  // 查 PaymentRecord
  const record = await qOne(
    "SELECT * FROM PaymentRecord WHERE orderType = ? AND orderId = ? AND status = 'PENDING'",
    orderType, orderId,
  );
  if (!record) return NextResponse.json({ error: "无待支付记录" }, { status: 400 });

  // 检查过期
  if (record.expireAt && new Date(record.expireAt as string) < new Date()) {
    await exec("UPDATE PaymentRecord SET status = 'EXPIRED' WHERE id = ?", record.id);
    return NextResponse.json({ error: "订单已过期" }, { status: 400 });
  }

  // 获取配置
  const { prisma } = await import("@/lib/prisma");
  const plugin = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  const config = (plugin?.config as Record<string, unknown>) || {};
  const provider = (config.provider as string) || "wechat";

  if (!config.paymentEnabled) return NextResponse.json({ error: "支付未启用" }, { status: 503 });

  const adapter = getAdapter(provider);
  if (!adapter) return NextResponse.json({ error: `支付渠道 "${provider}" 未注册` }, { status: 500 });

  try {
    const result = await adapter.createOrder(config, {
      outTradeNo: record.outTradeNo as string,
      amount: record.amount as number,
      description: orderType === "order" ? "商品购买" : "售后工单费用",
      payType: (payType || record.payType || "NATIVE") as PayType,
      notifyUrl: (config.notifyUrl as string) || "",
      expireAt: record.expireAt as string,
    });

    // 保存 qrCodeUrl / h5PayUrl 到 PaymentRecord
    if (result.qrCodeUrl || result.h5PayUrl) {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (result.qrCodeUrl) { sets.push("qrCodeUrl = ?"); params.push(result.qrCodeUrl); }
      if (result.h5PayUrl) { sets.push("h5PayUrl = ?"); params.push(result.h5PayUrl); }
      params.push(record.id);
      await exec(`UPDATE PaymentRecord SET ${sets.join(", ")} WHERE id = ?`, ...params);
    }

    return NextResponse.json({
      prepayId: result.prepayId,
      outTradeNo: record.outTradeNo,
      payType: result.payType,
      qrCodeUrl: result.qrCodeUrl,
      h5PayUrl: result.h5PayUrl,
      jsapiParams: result.jsapiParams,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "支付下单失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

// ──── 查询支付状态 ────

export const queryPayment: ApiHandler = async (_req, segs) => {
  const outTradeNo = segs[2]; // ["query", outTradeNo]
  const record = await qOne("SELECT * FROM PaymentRecord WHERE outTradeNo = ?", outTradeNo);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(camelKeys(record));
};

// ──── 支付回调（通过适配层验签） ────

export const paymentNotify: ApiHandler = async (req) => {
  const { prisma } = await import("@/lib/prisma");
  const plugin = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  const config = (plugin?.config as Record<string, unknown>) || {};
  const provider = (config.provider as string) || "wechat";

  const adapter = getAdapter(provider);
  if (!adapter) return NextResponse.json({ error: "支付渠道未注册" }, { status: 500 });

  let notifyResult;
  try {
    // 通过适配层验签 + 解密
    const rawBody = await req.json();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });

    notifyResult = await adapter.verifyNotify(config, rawBody, headers);
  } catch (err: unknown) {
    console.error("[payment] notify verify failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ code: "FAIL", message: "验签失败" }, { status: 400 });
  }

  // 查 PaymentRecord
  const record = await qOne("SELECT * FROM PaymentRecord WHERE outTradeNo = ?", notifyResult.outTradeNo);
  if (!record) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

  // 幂等
  if (record.status === "PAID") return NextResponse.json({ code: "SUCCESS" });

  // 金额校验
  if (Math.abs(notifyResult.amount - (record.amount as number)) > 0.01) {
    console.error(`[payment] notify amount mismatch: expected=${record.amount}, got=${notifyResult.amount}`);
    return NextResponse.json({ code: "FAIL", message: "金额不匹配" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // 更新支付记录
  await exec(
    "UPDATE PaymentRecord SET status = 'PAID', transactionId = ?, paidAt = ?, rawNotify = ? WHERE id = ?",
    notifyResult.transactionId, now, JSON.stringify(notifyResult.rawData), record.id,
  );

  // 按 orderType 更新关联订单
  if (record.orderType === "order") {
    await exec("UPDATE OrderInfo SET status = 'PAID', updatedAt = ? WHERE id = ?", now, record.orderId);
  } else if (record.orderType === "aftersales") {
    await exec("UPDATE AfterSalesOrder SET status = 'PAID', paidFee = ?, updatedAt = ? WHERE id = ?", record.amount, now, record.orderId);
  }

  return NextResponse.json({ code: "SUCCESS" });
};

// ──── 测试支付连接 ────

export const testConnection: ApiHandler = async () => {
  const { prisma } = await import("@/lib/prisma");
  const plugin = await prisma.plugin.findUnique({ where: { slug: "ecommerce" } });
  const config = (plugin?.config as Record<string, unknown>) || {};
  const provider = (config.provider as string) || "wechat";

  const adapter = getAdapter(provider);
  if (!adapter) return NextResponse.json({ error: `支付渠道 "${provider}" 未注册` }, { status: 500 });

  const result = await adapter.testConnection(config);
  return NextResponse.json(result);
};
