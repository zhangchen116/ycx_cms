import { add_filter, add_action } from "@/lib/hooks";
import { register_placeholder } from "@/lib/placeholder-registry";
import { registerPluginApiRoute } from "@/lib/plugin-loader";
import { dispatch } from "./api/router";
import { clientJS } from "./renderer/client";
import { cuid, qOne, exec } from "./lib/db";
import { registerAdapter, listAdapters } from "./payment/adapter";
import {
  renderProductCard,
  renderProductGrid,
  renderBuyButton,
  renderProductFilter,
  renderAfterSalesForm,
  renderAfterSalesPayment,
  renderAfterSalesStatus,
} from "./renderer/placeholders";
import { dashboard } from "./admin/dashboard";
import { productsList, productsEdit, attributes } from "./admin/products";
import { orders, afterSales, payment } from "./admin/management";

export default function register(config: Record<string, unknown>) {
  // ──── 数据库迁移 ────
  (async () => {
    const migrations: string[] = [
      "ALTER TABLE Product ADD COLUMN productCode TEXT",
      "ALTER TABLE Product ADD COLUMN quantity INTEGER DEFAULT 1",
      "ALTER TABLE Product ADD COLUMN content TEXT",
      "ALTER TABLE Product ADD COLUMN originalPrice REAL",
      "ALTER TABLE Product ADD COLUMN sku TEXT",
      "ALTER TABLE Product ADD COLUMN aiGenerated INTEGER DEFAULT 0",
      "ALTER TABLE Product ADD COLUMN tags TEXT",
      "ALTER TABLE Product ADD COLUMN publishedAt TEXT",
      "ALTER TABLE AfterSalesOrder ADD COLUMN pickupTime TEXT",
      "ALTER TABLE AfterSalesOrder ADD COLUMN trackingNo TEXT",
      "ALTER TABLE AfterSalesPricingRule ADD COLUMN formula TEXT",
      "ALTER TABLE AfterSalesPricingRule ADD COLUMN enabled INTEGER DEFAULT 1",
      "ALTER TABLE PaymentRecord ADD COLUMN currency TEXT DEFAULT 'CNY'",
      "ALTER TABLE PaymentRecord ADD COLUMN qrCodeUrl TEXT",
      "ALTER TABLE PaymentRecord ADD COLUMN h5PayUrl TEXT",
      "ALTER TABLE PaymentRecord ADD COLUMN rawNotify TEXT",
      "ALTER TABLE OrderInfo ADD COLUMN trackingNo TEXT",
      "ALTER TABLE Product ADD COLUMN postId TEXT",
    ];
    for (const sql of migrations) {
      try { await exec(sql); } catch { /* 字段已存在则跳过 */ }
    }
  })();

  // ──── Admin Menu ────
  add_filter("admin_menu", (items: unknown[]) => {
    const arr = items as Array<{ slug: string }>;
    if (arr.some(i => i.slug === "ecommerce")) return arr;
    return [
      ...arr,
      {
        slug: "ecommerce",
        label: "电商",
        icon: "🛒",
        subPages: [
          { slug: "products", label: "商品管理" },
          { slug: "attributes", label: "属性模板" },
          { slug: "orders", label: "订单管理" },
          { slug: "after-sales", label: "售后管理" },
          { slug: "payment", label: "支付设置" },
        ],
      },
    ];
  });

  // ──── Admin Pages ────
  add_filter("admin_page_ecommerce", () => dashboard({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_products", () => productsList({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_attributes", () => attributes({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_orders", () => orders({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_after-sales", () => afterSales({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_payment", () => payment({ userId: "", username: "", role: "" }));
  add_filter("admin_subpage_ecommerce_products/edit", () => productsEdit({ userId: "", username: "", role: "" }));

  // ──── API Routes ────
  const exactRoutes: [string, string][] = [
    ["GET", "/products"],
    ["POST", "/products"],
    ["PATCH", "/products/batch"],
    ["GET", "/products/categories"],
    ["POST", "/products/categories"],
    ["GET", "/attributes"],
    ["POST", "/attributes"],
    ["GET", "/attributes/filter-options"],
    ["POST", "/orders"],
    ["GET", "/orders"],
    ["POST", "/after-sales"],
    ["POST", "/after-sales/pay"],
    ["GET", "/after-sales"],
    ["GET", "/after-sales/pricing-rules"],
    ["POST", "/after-sales/pricing-rules"],
    ["GET", "/after-sales/calculate"],
    ["GET", "/payment/config"],
    ["PUT", "/payment/config"],
    ["POST", "/payment/unified-order"],
    ["POST", "/payment/notify"],
    ["POST", "/payment/test"],
  ];
  for (const [method, path] of exactRoutes) {
    registerPluginApiRoute("ecommerce", method, path, (req, segs) => dispatch(req, method, segs));
  }

  const wildcardMethods = ["GET", "PUT", "DELETE"];
  for (const method of wildcardMethods) {
    registerPluginApiRoute("ecommerce", method, "*", (req, segs) => dispatch(req, method, segs));
  }
  registerPluginApiRoute("ecommerce", "POST", "*", (req, segs) => dispatch(req, "POST", segs));

  // ──── Frontend Placeholders ────
  add_action("register_placeholders", () => {
    register_placeholder("product-card", renderProductCard, "ecommerce",
      '在页面 HTML 中插入指定 ID 的单个商品卡片，渲染商品图片、名称、价格和购买按钮。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="product-card" data-product-id="cmxxxxxx" data-show-price="true" data-show-badge="true"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-product-id` | string | 必填 | 商品 ID |\n' +
      '| `data-show-price` | bool | `true` | 是否显示价格 |\n' +
      '| `data-show-badge` | bool | `true` | 是否显示角标（新品/热卖） |'
    );

    register_placeholder("product-grid", renderProductGrid, "ecommerce",
      '在页面 HTML 中插入商品网格，自动加载已上架（PUBLISHED）的商品，支持分类过滤、排序和属性筛选器联动。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="product-grid" data-cols="3" data-category="phone" data-limit="12" data-order="desc" data-show-filters="true"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-cols` | number | `3` | 每行商品数，可选 `2`/`3`/`4` |\n' +
      '| `data-category` | string | 空（全部） | 按分类 slug 筛选商品 |\n' +
      '| `data-limit` | number | `12` | 展示数量 |\n' +
      '| `data-order` | string | `desc` | 排序方向 `asc`/`desc` |\n' +
      '| `data-show-filters` | bool | `false` | 是否显示属性筛选栏（SSR 模式） |\n' +
      '| `id` | string | 自动生成 | 网格容器 ID，用于与 `product-filter` 联动 |'
    );

    register_placeholder("buy-button", renderBuyButton, "ecommerce",
      '在页面 HTML 中插入单个商品的购买按钮。根据商品状态和支付方式自动切换行为。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="buy-button" data-product-id="cmxxxxxx" data-text="立即购买" data-style="primary"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-product-id` | string | 必填 | 商品 ID |\n' +
      '| `data-text` | string | `"立即购买"` | 按钮文案 |\n' +
      '| `data-style` | string | `"primary"` | `primary` / `outline` |'
    );

    register_placeholder("product-filter", renderProductFilter, "ecommerce",
      '在页面 HTML 中插入商品属性筛选器，与 `product-grid` 联动使用。根据后端已配置的属性模板动态生成筛选项，用户选择后实时过滤网格中的商品。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="product-filter" data-category="phone" data-target="#product-grid-container" data-layout="horizontal"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-category` | string | 必填 | 商品分类 slug |\n' +
      '| `data-target` | string | 必填 | 目标 `product-grid` 的 CSS 选择器 |\n' +
      '| `data-layout` | string | `"horizontal"` | `"horizontal"` / `"vertical"` |'
    );

    register_placeholder("after-sales-form", renderAfterSalesForm, "ecommerce",
      '在页面 HTML 中插入售后申请表单，用户可填写售后类型（维修/退货/换货/退款）、问题描述、联系信息。提交后自动跳转至支付环节。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="after-sales-form" data-product-id="cmxxxxxx"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-product-id` | string | 必填 | 关联商品 ID |'
    );

    register_placeholder("after-sales-payment", renderAfterSalesPayment, "ecommerce",
      '在页面 HTML 中插入售后费用支付组件，展示应付金额和支付二维码，倒计时自动过期。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="after-sales-payment" data-order-id="工单ID"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-order-id` | string | 必填 | AfterSalesOrder ID |'
    );

    register_placeholder("after-sales-status", renderAfterSalesStatus, "ecommerce",
      '在页面 HTML 中插入售后进度组件，展示工单时间线和取件信息。\n\n' +
      '```html\n' +
      '<div data-cms-plugin="after-sales-status" data-order-id="工单ID"></div>\n' +
      '```\n\n' +
      '| 配置项 | 类型 | 默认值 | 说明 |\n' +
      '|--------|------|--------|------|\n' +
      '| `data-order-id` | string | 必填 | AfterSalesOrder ID |'
    );
  });

  // ──── add_page 钩子 ────
  add_action("add_page", async (payload: unknown) => {
    const p = payload as { post: Record<string, unknown>; extendedParams: string };
    const { post, extendedParams } = p;
    if (!extendedParams) return;

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(extendedParams); } catch {
      console.error("[ecommerce] add_page: JSON解析失败", (extendedParams as string).slice(0, 200));
      return;
    }
    if (parsed.option !== "add_goods") return;

    const goods = parsed.goods as Record<string, unknown> | undefined;
    if (!goods || !goods.name) { console.error("[ecommerce] add_page: goods数据缺失"); return; }

    try {
      const postId = (post.id as string) || "";

      // 检查是否已有商品关联此帖子
      const existing = await qOne("SELECT id FROM Product WHERE postId = ?", postId);

      const title = goods.name as string;
      const productSlug = (goods.slug as string) || title.toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      const description = (goods.description as string) || "";
      const price = Number(goods.price) || 0;
      const originalPrice = Number(goods.originalPrice) || 0;
      const images = (goods.images as string) || "";
      const stock = Number(goods.stock) || 0;
      const quantity = Number(goods.quantity) || 1;
      const productCode = (goods.productCode as string) || "";
      const sku = (goods.sku as string) || productCode;
      const paymentMode = (goods.paymentMode as string) || "wechat";
      const buyLink = (goods.buyLink as string) || "";
      const status = (goods.status as string) || "PUBLISHED";
      const authorId = (post.authorId as string) || "";

      let categoryId = "";
      const categorySlug = goods.categorySlug as string;
      if (categorySlug) {
        const catRow = await qOne("SELECT id FROM ProductCategory WHERE slug = ?", categorySlug);
        if (catRow) { categoryId = catRow.id as string; } else {
          const newCatId = cuid();
          await exec("INSERT INTO ProductCategory (id, name, slug) VALUES (?, ?, ?)", newCatId, categorySlug, categorySlug);
          categoryId = newCatId;
        }
      }

      if (existing) {
        // 更新已有商品
        const productId = existing.id as string;
        await exec(
          `UPDATE Product SET title=?, slug=?, description=?, price=?, originalPrice=?, stock=?, quantity=?, productCode=?, sku=?, paymentMode=?, buyLink=?, images=?, categoryId=?, status=? WHERE id=?`,
          title, productSlug, description, price, originalPrice, stock, quantity, productCode, sku, paymentMode, buyLink, images, categoryId, status, productId,
        );
        console.log(`[ecommerce] add_page: 商品更新 ${title} (${productId})`);
      } else {
        // 新建商品
        const productId = cuid();
        await exec(
          `INSERT INTO Product (id, title, slug, description, price, originalPrice, stock, quantity, productCode, sku, paymentMode, buyLink, images, categoryId, authorId, status, postId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          productId, title, productSlug, description, price, originalPrice, stock, quantity, productCode, sku, paymentMode, buyLink, images, categoryId, authorId, status, postId,
        );
        console.log(`[ecommerce] add_page: 商品入库 ${title} (${productId})`);
      }
    } catch (err: unknown) {
      console.error("[ecommerce] add_page: 操作失败", err instanceof Error ? err.message : String(err));
    }
  });

  // ──── Client JS ────
  add_filter("wp_footer", (footer: string) => footer + clientJS());
}

export async function getSkillDocs(): Promise<string> {
  return `### extendedParams 参数说明

创建或更新商品帖子时，必须在 \`extendedParams\` 字段中传入以下 JSON 字符串：

\`\`\`json
{
  "option": "add_goods",
  "goods": {
    "name":           "string (必填) — 商品名称",
    "productCode":    "string (必填) — 商品编号/货号，如 SKU-001",
    "quantity":       "number (必填) — 商品数量，正整数",
    "price":          "number (必填) — 商品单价，单位：分（例如 899900 = ¥8999.00）",
    "originalPrice":  "number (可选) — 原价/划线价，单位：分",
    "slug":           "string (可选) — URL 标识，不传则自动从 name 生成",
    "description":    "string (可选) — 商品描述",
    "images":         "string (可选) — 图片 URL，多个用英文逗号分隔",
    "categorySlug":   "string (可选) — 商品分类 slug，不传则归入未分类",
    "stock":          "number (可选) — 库存数量，默认 0",
    "sku":            "string (可选) — SKU 编码",
    "paymentMode":    "string (可选) — 支付方式：wechat（微信支付）或 link（外链购买），默认 wechat",
    "buyLink":        "string (可选) — 外链购买 URL（paymentMode=link 时必填）"
  }
}
\`\`\`

### 🚨 必填项规则（最高优先级）

以下四个字段**必须**明确提供，缺一不可：

| 字段 | 说明 | 示例 |
|------|------|------|
| **name** | 商品名称 | iPhone 16 Pro 256GB 沙漠金 |
| **productCode** | 商品编号/货号 | SKU-20261001-001 |
| **quantity** | 商品数量 | 100 |
| **price** | 商品单价（分） | 899900 |

**规则**：
- 如果用户提供的信息中缺少以上任一字段，**必须询问用户补充**，不得编造或跳过
- 如果字段值模糊不清（如价格单位不明确），必须向用户确认后再继续
- 不得使用默认值填充必填字段`;
}
