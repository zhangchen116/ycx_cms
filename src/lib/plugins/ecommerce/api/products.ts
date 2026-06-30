import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { q, qOne, exec, cuid, camelKeys } from "../lib/db";

type ApiHandler = (req: NextRequest, segs: string[]) => Promise<NextResponse>;

function authErr(msg = "未登录") {
  return NextResponse.json({ error: msg }, { status: 401 });
}
function forbidden(msg = "无权限") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

// ──── Products ────

export const listProducts: ApiHandler = async (req) => {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status") || "PUBLISHED";
  const q_ = searchParams.get("q");
  const order = searchParams.get("order") || "desc";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);

  let sql = "SELECT * FROM Product WHERE 1=1";
  const params: unknown[] = [];

  // 支持通过 categoryId 或 category slug 筛选
  if (categoryId) {
    // 如果传的是 slug，先查 id
    const cat = await qOne("SELECT id FROM ProductCategory WHERE slug = ?", categoryId);
    if (cat) {
      sql += " AND categoryId = ?"; params.push(cat.id);
    } else {
      sql += " AND categoryId = ?"; params.push(categoryId);
    }
  }
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (q_) { sql += " AND (title LIKE ? OR description LIKE ?)"; const like = `%${q_}%`; params.push(like, like); }

  // SSR 属性筛选: ?attr_<slug>=<value>
  for (const [key, val] of searchParams.entries()) {
    if (key.startsWith("attr_") && val) {
      const slug = key.replace("attr_", "");
      sql += ` AND id IN (SELECT av.productId FROM ProductAttributeValue av JOIN ProductAttributeTemplate t ON av.templateId = t.id WHERE t.slug = ? AND av.attrValue = ?)`;
      params.push(slug, val);
    }
  }

  const orderDir = order === "asc" ? "ASC" : "DESC";
  sql += ` ORDER BY sort ASC, createdAt ${orderDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = await q(sql, ...params);
  return NextResponse.json(rows.map(camelKeys));
};

export const getProduct: ApiHandler = async (_req, segs) => {
  const id = segs[1];
  const row = await qOne("SELECT * FROM Product WHERE id = ?", id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attrs = await q(
    "SELECT av.*, t.name as templateName, t.slug as templateSlug FROM ProductAttributeValue av JOIN ProductAttributeTemplate t ON av.templateId = t.id WHERE av.productId = ?",
    id,
  );
  const cat = row.categoryId
    ? await qOne("SELECT * FROM ProductCategory WHERE id = ?", row.categoryId)
    : null;
  return NextResponse.json({
    ...camelKeys(row),
    images: safeParse(row.images),
    tags: safeParse(row.tags),
    attributes: attrs.map(camelKeys),
    category: cat ? camelKeys(cat) : null,
  });
};

function safeParse(v: unknown) {
  if (!v || typeof v !== "string") return [];
  try { return JSON.parse(v); } catch { return []; }
}

export const createProduct: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(session.role)) return forbidden();

  const body = await req.json();
  const id = cuid();
  const now = new Date().toISOString();
  const status = body.status || "DRAFT";

  await exec(
    `INSERT INTO Product (id, title, slug, description, content, price, originalPrice, stock, quantity, productCode, sku, paymentMode, buyLink, status, visibility, categoryId, authorId, images, aiGenerated, tags, sort, publishedAt, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, body.title || "未命名商品", body.slug || `product-${id.slice(-8)}`,
    body.description || "", body.content || null,
    body.price ?? 0, body.originalPrice ?? 0,
    body.stock ?? 0, body.quantity ?? 1,
    body.productCode || "", body.sku || body.productCode || "",
    body.paymentMode || "wechat", body.buyLink || "",
    status, body.visibility || "VISIBLE",
    body.categoryId || null, session.userId,
    JSON.stringify(body.images || []),
    body.aiGenerated ? 1 : 0, body.tags ? body.tags : null,
    body.sort ?? 0, status === "PUBLISHED" ? now : null,
    now, now,
  );

  // Handle attributes
  if (Array.isArray(body.attributeValues)) {
    for (const av of body.attributeValues) {
      await exec(
        "INSERT INTO ProductAttributeValue (id, productId, templateId, attrValue, createdAt) VALUES (?,?,?,?,?)",
        cuid(), id, av.templateId, av.attrValue, now,
      );
    }
  }

  return NextResponse.json({ id });
};

export const updateProduct: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(session.role)) return forbidden();

  const id = segs[1];
  const existing = await qOne("SELECT id, status FROM Product WHERE id = ?", id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const params: unknown[] = [];

  const updatable = [
    "title", "slug", "description", "content", "price", "originalPrice",
    "stock", "quantity", "productCode", "sku", "paymentMode", "buyLink",
    "status", "visibility", "categoryId", "sort", "aiGenerated",
  ];
  for (const key of updatable) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(body[key]);
    }
  }
  if (body.images !== undefined) { fields.push("images = ?"); params.push(JSON.stringify(body.images)); }
  if (body.tags !== undefined) { fields.push("tags = ?"); params.push(body.tags); }

  // 状态变更为 PUBLISHED 时设 publishedAt
  if (body.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    fields.push("publishedAt = ?"); params.push(now);
  }

  if (fields.length > 0) {
    fields.push("updatedAt = ?"); params.push(now);
    params.push(id);
    await exec(`UPDATE Product SET ${fields.join(", ")} WHERE id = ?`, ...params);
  }

  // Replace attributes
  if (Array.isArray(body.attributeValues)) {
    await exec("DELETE FROM ProductAttributeValue WHERE productId = ?", id);
    for (const av of body.attributeValues) {
      await exec(
        "INSERT INTO ProductAttributeValue (id, productId, templateId, attrValue, createdAt) VALUES (?,?,?,?,?)",
        cuid(), id, av.templateId, av.attrValue, now,
      );
    }
  }

  return NextResponse.json({ ok: true });
};

export const deleteProduct: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const id = segs[1];
  await exec("DELETE FROM Product WHERE id = ?", id);
  return NextResponse.json({ ok: true });
};

// ──── Batch Operations ────

/** PATCH /api/products/batch — 批量上架/下架/显隐/排序 */
export const batchProducts: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const body = await req.json();
  const { ids, action, value } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const placeholders = ids.map(() => "?").join(", ");

  switch (action) {
    case "status":
      await exec(`UPDATE Product SET status = ?, updatedAt = ? WHERE id IN (${placeholders})`, value, now, ...ids);
      break;
    case "visibility":
      await exec(`UPDATE Product SET visibility = ?, updatedAt = ? WHERE id IN (${placeholders})`, value, now, ...ids);
      break;
    case "delete":
      await exec(`UPDATE ProductAttributeValue WHERE productId IN (${placeholders})`, ...ids);
      await exec(`DELETE FROM Product WHERE id IN (${placeholders})`, ...ids);
      break;
    default:
      return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, affected: ids.length });
};

// ──── Categories ────

export const listCategories: ApiHandler = async (req) => {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (productId) {
    // 查询商品所属分类及其祖先（目前仅单层）
    const p = await qOne("SELECT categoryId FROM Product WHERE id = ?", productId);
    if (p?.categoryId) {
      const cat = await qOne("SELECT * FROM ProductCategory WHERE id = ?", p.categoryId);
      return NextResponse.json(cat ? [camelKeys(cat)] : []);
    }
    return NextResponse.json([]);
  }
  const rows = await q("SELECT * FROM ProductCategory ORDER BY sort ASC");
  return NextResponse.json(rows.map(camelKeys));
};

export const createCategory: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const body = await req.json();
  const id = cuid();
  const now = new Date().toISOString();
  await exec(
    "INSERT INTO ProductCategory (id, name, slug, sort, createdAt, updatedAt) VALUES (?,?,?,?,?,?)",
    id, body.name, body.slug || `cat-${id.slice(-8)}`, body.sort ?? 0, now, now,
  );
  return NextResponse.json({ id });
};

export const updateCategory: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const id = segs[2];
  const body = await req.json();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ["name", "slug", "sort"]) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); params.push(body[key]); }
  }
  if (fields.length === 0) return NextResponse.json({ ok: true });
  fields.push("updatedAt = ?"); params.push(now);
  params.push(id);
  await exec(`UPDATE ProductCategory SET ${fields.join(", ")} WHERE id = ?`, ...params);
  return NextResponse.json({ ok: true });
};

export const deleteCategory: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const id = segs[2];
  await exec("UPDATE Product SET categoryId = NULL WHERE categoryId = ?", id);
  await exec("DELETE FROM ProductCategory WHERE id = ?", id);
  return NextResponse.json({ ok: true });
};
