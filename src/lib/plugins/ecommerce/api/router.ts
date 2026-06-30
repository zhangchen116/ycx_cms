import { NextRequest, NextResponse } from "next/server";
import {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  batchProducts, listCategories, createCategory, updateCategory, deleteCategory,
} from "./products";
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate, getFilterOptions,
} from "./attributes";
import {
  listOrders, getOrder, createOrder, updateOrderStatus,
} from "./orders";
import {
  listAfterSales, getAfterSales, createAfterSales, updateAfterSales,
  calculateAfterSales, savePricingRule, listPricingRules, payAfterSales,
} from "./aftersales";
import {
  getConfig, updateConfig, unifiedOrder, queryPayment, paymentNotify, testConnection,
} from "./payment";

// 路由表：{ "METHOD path" → handler }
// segs 是 URL 中以 / 拆分的路径段数组，例如 /products/categories → ["products", "categories"]

export async function dispatch(
  req: NextRequest,
  method: string,
  segs: string[],
): Promise<NextResponse> {
  const path = segs.join("/");

  // ──── Products + Categories ────
  if (path === "products" && method === "GET") return listProducts(req, segs);
  if (path === "products" && method === "POST") return createProduct(req, segs);
  if (path === "products/batch" && method === "PATCH") return batchProducts(req, segs);
  if (path === "products/categories" && method === "GET") return listCategories(req, segs);
  if (path === "products/categories" && method === "POST") return createCategory(req, segs);
  if (path.match(/^products\/categories\/\w+$/) && method === "PUT") return updateCategory(req, segs);
  if (path.match(/^products\/categories\/\w+$/) && method === "DELETE") return deleteCategory(req, segs);
  if (path.match(/^products\/\w+$/) && method === "GET") return getProduct(req, segs);
  if (path.match(/^products\/\w+$/) && method === "PUT") return updateProduct(req, segs);
  if (path.match(/^products\/\w+$/) && method === "DELETE") return deleteProduct(req, segs);

  // ──── Attributes ────
  if (path === "attributes" && method === "GET") return listTemplates(req, segs);
  if (path === "attributes" && method === "POST") return createTemplate(req, segs);
  if (path === "attributes/filter-options" && method === "GET") return getFilterOptions(req, segs);
  if (path.match(/^attributes\/\w+$/) && method === "PUT") return updateTemplate(req, segs);
  if (path.match(/^attributes\/\w+$/) && method === "DELETE") return deleteTemplate(req, segs);

  // ──── Orders ────
  if (path === "orders" && method === "GET") return listOrders(req, segs);
  if (path === "orders" && method === "POST") return createOrder(req, segs);
  if (path.match(/^orders\/\w+$/) && method === "GET") return getOrder(req, segs);
  if (path.match(/^orders\/\w+\/status$/) && method === "PUT") return updateOrderStatus(req, segs);

  // ──── After-Sales ────
  if (path === "after-sales" && method === "GET") return listAfterSales(req, segs);
  if (path === "after-sales" && method === "POST") return createAfterSales(req, segs);
  if (path === "after-sales/pay" && method === "POST") return payAfterSales(req, segs);
  if (path === "after-sales/calculate" && method === "GET") return calculateAfterSales(req, segs);
  if (path === "after-sales/pricing-rules" && method === "GET") return listPricingRules(req, segs);
  if (path === "after-sales/pricing-rules" && method === "POST") return savePricingRule(req, segs);
  if (path.match(/^after-sales\/\w+$/) && method === "GET") return getAfterSales(req, segs);
  if (path.match(/^after-sales\/\w+$/) && method === "PUT") return updateAfterSales(req, segs);

  // ──── Payment ────
  if (path === "payment/config" && method === "GET") return getConfig(req, segs);
  if (path === "payment/config" && method === "PUT") return updateConfig(req, segs);
  if (path === "payment/unified-order" && method === "POST") return unifiedOrder(req, segs);
  if (path === "payment/notify" && method === "POST") return paymentNotify(req, segs);
  if (path === "payment/test" && method === "POST") return testConnection(req, segs);
  if (path.match(/^payment\/query\/\w+$/) && method === "GET") return queryPayment(req, segs);

  return NextResponse.json({ error: `Not found: ${method} /${path}` }, { status: 404 });
}
