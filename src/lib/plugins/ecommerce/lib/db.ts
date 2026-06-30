import { prisma } from "@/lib/prisma";

/** 生成 32 位 CUID */
export function cuid(): string {
  const t = Date.now().toString(36);
  const r = () => Math.random().toString(36).slice(2, 10);
  return `${t}${r()}${r()}`;
}

/** 生成商户订单号 */
export function genOutTradeNo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ECO${ts}${rand}`;
}

/** 裸查询，统一返回 any[] */
export async function q(
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown>[]> {
  return (await prisma.$queryRawUnsafe(sql, ...params)) as Record<string, unknown>[];
}

/** 单条查询 */
export async function qOne(
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown> | null> {
  const rows = await q(sql, ...params);
  return rows[0] ?? null;
}

/** 执行写操作 */
export async function exec(sql: string, ...params: unknown[]): Promise<void> {
  await prisma.$executeRawUnsafe(sql, ...params);
}

/** 下划线转驼峰 */
export function camelKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = obj[key];
  }
  return result;
}
