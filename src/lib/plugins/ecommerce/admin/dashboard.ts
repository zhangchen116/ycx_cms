import type { SessionPayload } from "@/lib/auth";

type AdminRenderer = (session: SessionPayload) => string;

export const dashboard: AdminRenderer = () => {
  return `
<div class="p-6">
  <h2 class="text-xl font-bold mb-4">🛒 电商仪表盘</h2>
  <div class="grid grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-lg p-4 shadow">
      <div class="text-sm text-gray-500">商品总数</div>
      <div class="text-2xl font-bold" id="stat-products">-</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow">
      <div class="text-sm text-gray-500">在售</div>
      <div class="text-2xl font-bold text-green-600" id="stat-published">-</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow">
      <div class="text-sm text-gray-500">待处理工单</div>
      <div class="text-2xl font-bold text-orange-600" id="stat-aftersales">-</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow">
      <div class="text-sm text-gray-500">今日订单</div>
      <div class="text-2xl font-bold text-blue-600" id="stat-orders">-</div>
    </div>
  </div>
  <div class="bg-white rounded-lg p-4 shadow">
    <h3 class="font-bold mb-2">快捷入口</h3>
    <div class="flex gap-4">
      <a href="/admin/plugin/ecommerce/products" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">商品管理</a>
      <a href="/admin/plugin/ecommerce/orders" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">订单管理</a>
      <a href="/admin/plugin/ecommerce/after-sales" class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">售后管理</a>
      <a href="/admin/plugin/ecommerce/payment" class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">支付设置</a>
    </div>
  </div>
  <script>
    (async () => {
      try {
        var r1 = await fetch('/api/plugin/ecommerce/products?limit=200');
        var d1 = await r1.json();
        document.getElementById('stat-products').textContent = Array.isArray(d1) ? d1.length : '0';

        var r2 = await fetch('/api/plugin/ecommerce/products?status=PUBLISHED&limit=200');
        var d2 = await r2.json();
        document.getElementById('stat-published').textContent = Array.isArray(d2) ? d2.length : '0';

        var r3 = await fetch('/api/plugin/ecommerce/after-sales?status=PENDING&limit=200');
        var d3 = await r3.json();
        document.getElementById('stat-aftersales').textContent = Array.isArray(d3) ? d3.length : '0';

        var today = new Date().toISOString().slice(0,10);
        var r4 = await fetch('/api/plugin/ecommerce/orders?limit=200');
        var d4 = await r4.json();
        var todayOrders = Array.isArray(d4) ? d4.filter(function(o) { return o.createdAt && o.createdAt.startsWith(today); }).length : 0;
        document.getElementById('stat-orders').textContent = todayOrders;
      } catch(e) { console.error(e); }
    })();
  </script>
</div>`;
};
