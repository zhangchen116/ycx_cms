/** 商品占位符渲染 — 服务端输出静态骨架，client.ts 负责水合 */

const COL_CLASSES: Record<string, string> = {
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function renderProductCard(
  attrs: Record<string, string>,
): string {
  const pid = attrs["data-product-id"] || "";
  const showPrice = attrs["data-show-price"] !== "false";
  const showBadge = attrs["data-show-badge"] !== "false";

  return `<div class="cms-product-card" data-cms-plugin="product-card" data-product-id="${pid}" data-show-price="${showPrice}" data-show-badge="${showBadge}">
  <div class="cms-product-card-inner bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">
    <div class="cms-product-card-image bg-gray-100 h-48 flex items-center justify-center text-gray-400 text-sm">加载中...</div>
    <div class="p-3">
      <a class="cms-product-card-title text-sm font-medium line-clamp-2 hover:text-blue-600" href="#" style="display:block;min-height:2.5rem">加载中...</a>
      <div class="mt-2 flex items-center justify-between">
        <span class="cms-product-card-price text-red-500 font-bold">--</span>
        <button class="cms-product-card-buy px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">购买</button>
      </div>
    </div>
  </div>
</div>`;
}

export function renderProductGrid(
  attrs: Record<string, string>,
): string {
  const cols = attrs["data-cols"] || "3";
  const catSlug = attrs["data-category"] || "";
  const limit = attrs["data-limit"] || "12";
  const order = attrs["data-order"] || "desc";
  const showFilters = attrs["data-show-filters"] || "false";
  const gridClass = COL_CLASSES[cols] || COL_CLASSES["3"];
  const containerId = `product-grid-${Math.random().toString(36).slice(2, 8)}`;

  return `<div class="cms-product-grid" data-cms-plugin="product-grid" data-cols="${cols}" data-category="${catSlug}" data-limit="${limit}" data-order="${order}" data-show-filters="${showFilters}" id="${containerId}">
  <div class="cms-product-grid-filter flex gap-2 mb-4 flex-wrap" id="${containerId}-filter"${showFilters !== "true" ? " style='display:none'" : ""}></div>
  <div class="${gridClass} gap-4" id="${containerId}-grid">
    <div class="text-gray-400 text-sm p-8 text-center col-span-full">加载中...</div>
  </div>
</div>`;
}

export function renderBuyButton(
  attrs: Record<string, string>,
): string {
  const productId = attrs["data-product-id"] || "";
  const text = attrs["data-text"] || "立即购买";
  const style = attrs["data-style"] || "primary";
  const cls = style === "outline"
    ? "border border-blue-500 text-blue-500 bg-white hover:bg-blue-50"
    : "bg-blue-500 text-white hover:bg-blue-600";

  return `<div class="cms-buy-button" data-cms-plugin="buy-button" data-product-id="${productId}" data-text="${text}" data-style="${style}">
  <button class="cms-buy-btn rounded transition-colors px-5 py-2 text-sm ${cls}" disabled>加载中...</button>
</div>`;
}

export function renderProductFilter(
  attrs: Record<string, string>,
): string {
  const category = attrs["data-category"] || "";
  const target = attrs["data-target"] || "";
  const layout = attrs["data-layout"] || "horizontal";
  const filterId = `product-filter-${Math.random().toString(36).slice(2, 8)}`;
  const layoutClass = layout === "vertical" ? "flex flex-col gap-3" : "flex gap-4 flex-wrap";

  return `<div class="cms-product-filter ${layoutClass} mb-4" data-cms-plugin="product-filter" data-category="${category}" data-target="${target}" data-layout="${layout}" id="${filterId}">
  <div class="text-sm text-gray-400">筛选选项加载中...</div>
</div>`;
}

export function renderAfterSalesForm(
  attrs: Record<string, string>,
): string {
  const productId = attrs["data-product-id"] || "";
  const formId = `as-form-${Math.random().toString(36).slice(2, 8)}`;

  return `<div class="cms-after-sales-form max-w-lg mx-auto bg-white rounded-lg shadow p-6" data-cms-plugin="after-sales-form" data-product-id="${productId}" id="${formId}">
  <h3 class="text-lg font-bold mb-4">售后申请</h3>
  <form id="${formId}-form" class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">售后类型</label>
      <select name="type" class="w-full border rounded px-3 py-1.5 text-sm">
        <option value="REPAIR">维修</option>
        <option value="RETURN">退货</option>
        <option value="EXCHANGE">换货</option>
        <option value="REFUND">退款</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">问题描述</label>
      <textarea name="description" rows="4" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="请描述您遇到的问题..."></textarea>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div><label class="block text-sm font-medium mb-1">联系人</label><input name="contactName" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
      <div><label class="block text-sm font-medium mb-1">联系电话</label><input name="contactPhone" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
    </div>
    <div><label class="block text-sm font-medium mb-1">取件地址</label><input name="pickupAddress" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
    <div id="${formId}-fee" class="text-sm text-gray-500 hidden">
      预估费用：<span class="font-bold text-red-500" id="${formId}-fee-amount">¥0.00</span>
      （基础费 <span id="${formId}-base-fee">0</span> + 原价 × <span id="${formId}-rate">0%</span>）
    </div>
    <button type="submit" class="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600">提交申请</button>
  </form>
</div>`;
}

export function renderAfterSalesPayment(
  attrs: Record<string, string>,
): string {
  const orderId = attrs["data-order-id"] || "";
  const id = `as-payment-${Math.random().toString(36).slice(2, 8)}`;

  return `<div class="cms-after-sales-payment max-w-sm mx-auto bg-white rounded-lg shadow p-6 text-center" data-cms-plugin="after-sales-payment" data-order-id="${orderId}" id="${id}">
  <h3 class="text-lg font-bold mb-3">支付售后费用</h3>
  <div id="${id}-info" class="text-sm text-gray-500 mb-4">加载中...</div>
  <div id="${id}-qrcode" class="hidden">
    <div id="${id}-qr-img" class="w-48 h-48 bg-gray-100 mx-auto mb-3 flex items-center justify-center text-gray-400 text-sm">二维码</div>
    <div class="text-sm text-gray-500">支付金额：<span class="font-bold text-red-500" id="${id}-amount">¥0.00</span></div>
    <div class="text-xs text-gray-400 mt-1">请在 <span id="${id}-expire">2小时</span> 内完成支付</div>
  </div>
</div>`;
}

export function renderAfterSalesStatus(
  attrs: Record<string, string>,
): string {
  const orderId = attrs["data-order-id"] || "";
  const id = `as-status-${Math.random().toString(36).slice(2, 8)}`;

  return `<div class="cms-after-sales-status max-w-md mx-auto bg-white rounded-lg shadow p-6" data-cms-plugin="after-sales-status" data-order-id="${orderId}" id="${id}">
  <h3 class="text-lg font-bold mb-4">售后进度</h3>
  <div id="${id}-timeline">
    <div class="text-sm text-gray-500 flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-gray-300 inline-block"></span> <span>已提交</span>
    </div>
    <div class="h-6 w-0.5 bg-gray-200 ml-1.5"></div>
    <div class="text-sm text-gray-400 flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-gray-300 inline-block"></span> <span>待支付</span>
    </div>
    <div class="h-6 w-0.5 bg-gray-200 ml-1.5"></div>
    <div class="text-sm text-gray-400 flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-gray-300 inline-block"></span> <span>待取件</span>
    </div>
    <div class="h-6 w-0.5 bg-gray-200 ml-1.5"></div>
    <div class="text-sm text-gray-400 flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-gray-300 inline-block"></span> <span>处理中</span>
    </div>
    <div class="h-6 w-0.5 bg-gray-200 ml-1.5"></div>
    <div class="text-sm text-gray-400 flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-gray-300 inline-block"></span> <span>已完成</span>
    </div>
  </div>
  <div id="${id}-detail" class="mt-4 text-sm text-gray-500 hidden">
    <div class="grid grid-cols-2 gap-2">
      <div><span class="text-gray-400">类型：</span><span id="${id}-r-type">-</span></div>
      <div><span class="text-gray-400">状态：</span><span id="${id}-r-status">-</span></div>
      <div><span class="text-gray-400">费用：</span><span id="${id}-r-fee">-</span></div>
      <div><span class="text-gray-400">支付：</span><span id="${id}-r-paid">-</span></div>
      <div class="col-span-2"><span class="text-gray-400">快递单号：</span><span id="${id}-r-tracking">-</span></div>
    </div>
  </div>
  <div id="${id}-pickup" class="mt-4 hidden">
    <h4 class="text-sm font-medium mb-2">取件信息</h4>
    <div class="space-y-2">
      <input id="${id}-pu-address" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="取件地址" />
      <input id="${id}-pu-time" type="datetime-local" class="w-full border rounded px-3 py-1.5 text-sm" />
      <button onclick="window.__asSchedulePickup('${id}','${orderId}')" class="px-4 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">预约取件</button>
    </div>
  </div>
</div>`;
}
