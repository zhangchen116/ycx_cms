import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { q, qOne, exec, cuid, camelKeys, genOutTradeNo } from "../lib/db";

type ApiHandler = (req: NextRequest, segs: string[]) => Promise<NextResponse>;

function authErr() { return NextResponse.json({ error: "未登录" }, { status: 401 }); }

// ──── After-Sales Orders ────

/** 公开：提交售后申请 */
export const createAfterSales: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();

  const body = await req.json();
  const productId = body.productId;
  const type = body.type; // REPAIR/RETURN/EXCHANGE/REFUND

  if (!["REPAIR", "RETURN", "EXCHANGE", "REFUND"].includes(type)) {
    return NextResponse.json({ error: "无效的售后类型" }, { status: 400 });
  }

  const product = await qOne("SELECT * FROM Product WHERE id = ?", productId);
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });

  const originalPrice = product.price as number;

  // 计算费用
  const rule = await qOne("SELECT * FROM AfterSalesPricingRule WHERE type = ?", type);
  let calculatedFee = 0;
  if (rule) {
    calculatedFee = (rule.baseFee as number) + originalPrice * (rule.rate as number);
    calculatedFee = Math.round(calculatedFee * 100) / 100;
  }

  const id = cuid();
  const now = new Date().toISOString();
  await exec(
    `INSERT INTO AfterSalesOrder (id, type, status, description, images, contactName, contactPhone, pickupAddress, originalPrice, calculatedFee, productId, authorId, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, type, "PENDING",
    body.description || "", JSON.stringify(body.images || []),
    body.contactName || "", body.contactPhone || "", body.pickupAddress || "",
    originalPrice, calculatedFee,
    productId, session.userId, now, now,
  );

  return NextResponse.json({ id, calculatedFee });
};

/** 公开：用户支付售后费用，生成 PaymentRecord */
export const payAfterSales: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();

  const body = await req.json();
  const afterSalesId = body.afterSalesId;

  const asOrder = await qOne("SELECT * FROM AfterSalesOrder WHERE id = ?", afterSalesId);
  if (!asOrder) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (asOrder.status !== "PENDING") return NextResponse.json({ error: "工单状态不允许支付" }, { status: 400 });

  const outTradeNo = genOutTradeNo();
  const paymentId = cuid();
  const now = new Date().toISOString();
  const expireAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  await exec(
    "INSERT INTO PaymentRecord (id, outTradeNo, amount, status, payType, orderType, orderId, expireAt, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
    paymentId, outTradeNo, asOrder.calculatedFee, "PENDING", body.payType || "NATIVE", "aftersales", afterSalesId, expireAt, now, now,
  );

  await exec("UPDATE AfterSalesOrder SET paymentRecordId = ?, updatedAt = ? WHERE id = ?", paymentId, now, afterSalesId);
  return NextResponse.json({ paymentId, outTradeNo, amount: asOrder.calculatedFee, expireAt });
};

// getAfterSales 定义在上方

// ──── Admin ────

export const listAfterSales: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
  const offset = Number(searchParams.get("offset") || 0);

  let sql = "SELECT * FROM AfterSalesOrder WHERE 1=1";
  const params: unknown[] = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (type) { sql += " AND type = ?"; params.push(type); }
  sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await q(sql, ...params);
  return NextResponse.json(rows.map(r => ({
    ...camelKeys(r),
    images: r.images ? JSON.parse(r.images as string) : [],
  })));
};

export const getAfterSales: ApiHandler = async (_req, segs) => {
  const id = segs[1];
  const asOrder = await qOne("SELECT * FROM AfterSalesOrder WHERE id = ?", id);
  if (!asOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payment = asOrder.paymentRecordId
    ? await qOne("SELECT * FROM PaymentRecord WHERE id = ?", asOrder.paymentRecordId)
    : null;
  return NextResponse.json({
    ...camelKeys(asOrder),
    images: asOrder.images ? JSON.parse(asOrder.images as string) : [],
    payment: payment ? camelKeys(payment) : null,
  });
};

export const updateAfterSales: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const id = segs[2];
  const body = await req.json();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of ["status", "type", "calculatedFee", "paidFee", "contactName", "contactPhone", "pickupAddress", "pickupTime", "trackingNo"]) {
    if (body[key] !== undefined) { sets.push(`${key} = ?`); params.push(body[key]); }
  }
  if (sets.length === 0) return NextResponse.json({ ok: true });
  sets.push("updatedAt = ?"); params.push(now);
  params.push(id);
  await exec(`UPDATE AfterSalesOrder SET ${sets.join(", ")} WHERE id = ?`, ...params);
  return NextResponse.json({ ok: true });
};

// ──── Pricing Rules ────

export const listPricingRules: ApiHandler = async () => {
  const rows = await q("SELECT * FROM AfterSalesPricingRule");
  return NextResponse.json(rows.map(camelKeys));
};

export const savePricingRule: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const existing = await qOne("SELECT * FROM AfterSalesPricingRule WHERE type = ?", body.type);

  const now = new Date().toISOString();
  if (existing) {
    await exec(
      "UPDATE AfterSalesPricingRule SET baseFee = ?, rate = ?, updatedAt = ? WHERE type = ?",
      body.baseFee ?? 0, body.rate ?? 0, now, body.type,
    );
  } else {
    await exec(
      "INSERT INTO AfterSalesPricingRule (id, type, baseFee, rate, createdAt, updatedAt) VALUES (?,?,?,?,?,?)",
      cuid(), body.type, body.baseFee ?? 0, body.rate ?? 0, now, now,
    );
  }
  return NextResponse.json({ ok: true });
};

export const calculateAfterSales: ApiHandler = async (req) => {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const type = searchParams.get("type");

  if (!productId || !type) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  const product = await qOne("SELECT price FROM Product WHERE id = ?", productId);
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });

  const rule = await qOne("SELECT * FROM AfterSalesPricingRule WHERE type = ?", type);
  if (!rule) return NextResponse.json({ error: "该类型暂未配置计价规则" }, { status: 404 });

  const price = product.price as number;
  const fee = Math.round(((rule.baseFee as number) + price * (rule.rate as number)) * 100) / 100;
  return NextResponse.json({ originalPrice: price, baseFee: rule.baseFee, rate: rule.rate, calculatedFee: fee });
};
