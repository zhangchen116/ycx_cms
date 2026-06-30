import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { q, qOne, exec, cuid, camelKeys, genOutTradeNo } from "../lib/db";

type ApiHandler = (req: NextRequest, segs: string[]) => Promise<NextResponse>;

function authErr() { return NextResponse.json({ error: "未登录" }, { status: 401 }); }

// ──── Orders ────

/** 公开：创建订单 */
export const createOrder: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();

  const body = await req.json();
  const productId = body.productId;
  const quantity = body.quantity || 1;

  // 查商品
  const product = await qOne("SELECT * FROM Product WHERE id = ? AND status = 'PUBLISHED'", productId);
  if (!product) return NextResponse.json({ error: "商品不存在或已下架" }, { status: 404 });
  if ((product.stock as number) < quantity) return NextResponse.json({ error: "库存不足" }, { status: 400 });

  const amount = (product.price as number) * quantity;
  const outTradeNo = genOutTradeNo();
  const orderId = cuid();
  const now = new Date().toISOString();
  const expireAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  // 预扣库存
  await exec("UPDATE Product SET stock = stock - ? WHERE id = ?", quantity, productId);

  // 创建订单
  await exec(
    "INSERT INTO OrderInfo (id, outTradeNo, productId, productSnap, quantity, amount, deliveryInfo, status, authorId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    orderId, outTradeNo, productId,
    JSON.stringify({ title: product.title, price: product.price, images: product.images }),
    quantity, amount,
    JSON.stringify(body.deliveryInfo || {}),
    "PENDING", session.userId, now, now,
  );

  // 创建支付记录
  const paymentId = cuid();
  await exec(
    "INSERT INTO PaymentRecord (id, outTradeNo, amount, status, payType, orderType, orderId, expireAt, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
    paymentId, outTradeNo, amount, "PENDING", body.payType || "NATIVE", "order", orderId, expireAt, now, now,
  );

  return NextResponse.json({ orderId, outTradeNo, amount, expireAt });
};

export const listOrders: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
  const offset = Number(searchParams.get("offset") || 0);

  let sql = "SELECT * FROM OrderInfo WHERE 1=1";
  const params: unknown[] = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await q(sql, ...params);
  return NextResponse.json(rows.map(camelKeys));
};

export const getOrder: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();

  const id = segs[1]; // ["orders", id]
  const order = await qOne("SELECT * FROM OrderInfo WHERE id = ?", id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payment = await qOne("SELECT * FROM PaymentRecord WHERE orderType = 'order' AND orderId = ?", id);

  return NextResponse.json({
    ...camelKeys(order),
    productSnap: order.productSnap ? JSON.parse(order.productSnap as string) : null,
    deliveryInfo: order.deliveryInfo ? JSON.parse(order.deliveryInfo as string) : null,
    payment: payment ? camelKeys(payment) : null,
  });
};

/** 管理员手动更新订单状态 */
export const updateOrderStatus: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const id = segs[1];
  const body = await req.json();
  const now = new Date().toISOString();

  const sets = ["status = ?"];
  const params: unknown[] = [body.status];
  if (body.trackingNo !== undefined) { sets.push("trackingNo = ?"); params.push(body.trackingNo); }
  sets.push("updatedAt = ?"); params.push(now);
  params.push(id);
  await exec(`UPDATE OrderInfo SET ${sets.join(", ")} WHERE id = ?`, ...params);

  if (body.status === "CANCELLED") {
    // 释放库存
    const order = await qOne("SELECT productId, quantity FROM OrderInfo WHERE id = ?", id);
    if (order) {
      await exec("UPDATE Product SET stock = stock + ? WHERE id = ?", order.quantity, order.productId);
    }
  }

  return NextResponse.json({ ok: true });
};
