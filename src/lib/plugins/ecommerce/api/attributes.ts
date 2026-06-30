import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { q, qOne, exec, cuid, camelKeys } from "../lib/db";

type ApiHandler = (req: NextRequest, segs: string[]) => Promise<NextResponse>;

function authErr() { return NextResponse.json({ error: "未登录" }, { status: 401 }); }
function forbidden() { return NextResponse.json({ error: "无权限" }, { status: 403 }); }

// ──── Attribute Templates ────

export const listTemplates: ApiHandler = async () => {
  const rows = await q("SELECT * FROM ProductAttributeTemplate ORDER BY sort ASC");
  return NextResponse.json(rows.map(r => ({
    ...camelKeys(r),
    attrValues: (r.attrValues as string) ? JSON.parse(r.attrValues as string) : [],
  })));
};

export const createTemplate: ApiHandler = async (req) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const body = await req.json();
  const id = cuid();
  const now = new Date().toISOString();
  await exec(
    "INSERT INTO ProductAttributeTemplate (id, name, slug, attrValues, filterable, sort, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
    id, body.name, body.slug || `attr-${id.slice(-8)}`,
    JSON.stringify(body.attrValues || []), body.filterable ? 1 : 0, body.sort ?? 0, now, now,
  );
  return NextResponse.json({ id });
};

export const updateTemplate: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const id = segs[2]; // ["attributes", id]
  const body = await req.json();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (key === "attrValues") {
      sets.push("attrValues = ?");
      params.push(JSON.stringify(val));
    } else if (key === "filterable") {
      sets.push("filterable = ?");
      params.push(val ? 1 : 0);
    } else if (["name", "slug", "sort"].includes(key)) {
      sets.push(`${key} = ?`);
      params.push(val);
    }
  }
  if (sets.length === 0) return NextResponse.json({ ok: true });
  sets.push("updatedAt = ?"); params.push(now);
  params.push(id);
  await exec(`UPDATE ProductAttributeTemplate SET ${sets.join(", ")} WHERE id = ?`, ...params);
  return NextResponse.json({ ok: true });
};

export const deleteTemplate: ApiHandler = async (req, segs) => {
  const session = await getSessionFromRequest(req);
  if (!session) return authErr();
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.role)) return forbidden();

  const id = segs[2];
  await exec("DELETE FROM ProductAttributeValue WHERE templateId = ?", id);
  await exec("DELETE FROM ProductAttributeTemplate WHERE id = ?", id);
  return NextResponse.json({ ok: true });
};

// ──── Filter Options (for product-grid filter bar) ────

/** 返回可用于筛选的属性名及其可选值 */
export const getFilterOptions: ApiHandler = async (req) => {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const templates = await q("SELECT * FROM ProductAttributeTemplate WHERE filterable = 1 ORDER BY sort ASC");
  const options: Record<string, unknown>[] = [];

  for (const t of templates) {
    let sql = "SELECT DISTINCT av.attrValue FROM ProductAttributeValue av JOIN Product p ON av.productId = p.id WHERE av.templateId = ? AND p.status = 'PUBLISHED'";
    const params: unknown[] = [t.id];
    if (categoryId) { sql += " AND p.categoryId = ?"; params.push(categoryId); }
    const rows = await q(sql, ...params);
    const values = rows.map(r => r.attrValue);
    if (values.length > 0) {
      options.push({
        templateId: t.id,
        name: t.name,
        slug: t.slug,
        values,
      });
    }
  }

  return NextResponse.json(options);
};
