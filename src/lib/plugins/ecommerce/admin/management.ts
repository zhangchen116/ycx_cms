import type { SessionPayload } from "@/lib/auth";

type AdminRenderer = (session: SessionPayload) => string;

export const orders: AdminRenderer = () => {
  return `
<div class="p-4">
  <h2 class="text-xl font-bold mb-4">订单管理</h2>

  <div class="flex gap-2 mb-4">
    <select id="status-filter" class="border rounded px-3 py-1.5 text-sm" onchange="loadOrders()">
      <option value="">全部状态</option>
      <option value="PENDING">待支付</option>
      <option value="PAID">已支付</option>
      <option value="SHIPPED">已发货</option>
      <option value="COMPLETED">已完成</option>
      <option value="CANCELLED">已取消</option>
    </select>
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-3 text-left w-32">订单号</th>
          <th class="p-3 text-left">商品</th>
          <th class="p-3 text-left">收货信息</th>
          <th class="p-3 text-left w-20">数量</th>
          <th class="p-3 text-left w-24">金额</th>
          <th class="p-3 text-left w-20">状态</th>
          <th class="p-3 text-left w-36">时间</th>
          <th class="p-3 text-right w-40">操作</th>
        </tr>
      </thead>
      <tbody id="tbl-body" class="divide-y"></tbody>
    </table>
  </div>

  <!-- 发货弹窗 -->
  <div id="ship-modal" class="hidden fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl p-6 w-80">
      <h3 class="font-bold mb-4">发货</h3>
      <div class="space-y-3">
        <div><label class="text-sm">快递单号</label><input id="ship-tracking" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div class="flex gap-2">
          <button id="ship-confirm" class="px-4 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">确认发货</button>
          <button onclick="document.getElementById('ship-modal').classList.add('hidden')" class="px-4 py-1.5 border rounded text-sm">取消</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
  var currentShipId = null;

  async function loadOrders() {
    var status = document.getElementById('status-filter').value;
    var params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);

    var r = await fetch('/api/plugin/ecommerce/orders?' + params);
    var orders = await r.json();
    document.getElementById('tbl-body').innerHTML = orders.map(function(o) {
      var snap = typeof o.productSnap==='object' ? o.productSnap : {};
      var delivery = typeof o.deliveryInfo==='object' ? o.deliveryInfo : {};
      var dInfo = (delivery.name||'') + ' ' + (delivery.phone||'') + ' ' + (delivery.address||'');
      return '<tr class="hover:bg-gray-50"><td class="p-3 text-xs font-mono">'+esc(o.outTradeNo||'-')+'</td>' +
        '<td class="p-3">'+esc(snap.title||'-')+'</td>' +
        '<td class="p-3 text-xs text-gray-500">'+esc(dInfo.trim()||'未填写')+(o.trackingNo?'<br/>📦 '+esc(o.trackingNo):'')+'</td>' +
        '<td class="p-3">'+(o.quantity||0)+'</td>' +
        '<td class="p-3">¥'+(Number(o.amount)||0).toFixed(2)+'</td>' +
        '<td class="p-3"><span class="px-2 py-0.5 rounded text-xs '+statusClass(o.status)+'">'+statusLabel(o.status)+'</span></td>' +
        '<td class="p-3 text-xs text-gray-500">'+new Date(o.createdAt).toLocaleString('zh-CN')+'</td>' +
        '<td class="p-3 text-right">' +
          (o.status==='PENDING' ? '<button data-action="cancel" data-id="'+esc(o.id)+'" class="text-red-500 hover:underline text-xs">取消</button>' : '') +
          (o.status==='PAID' ? '<button data-action="ship" data-id="'+esc(o.id)+'" class="text-blue-500 hover:underline text-xs ml-2">发货</button>' : '') +
          (o.status==='SHIPPED' ? '<button data-action="complete" data-id="'+esc(o.id)+'" class="text-green-500 hover:underline text-xs ml-2">完成</button>' : '') +
        '</td></tr>';
    }).join('');
  }

  function openShip(id) {
    currentShipId = id;
    document.getElementById('ship-modal').classList.remove('hidden');
    document.getElementById('ship-tracking').value = '';
  }

  document.getElementById('ship-confirm').addEventListener('click', async function() {
    var tracking = document.getElementById('ship-tracking').value;
    if (!tracking) { alert('请输入快递单号'); return; }
    await fetch('/api/plugin/ecommerce/orders/'+currentShipId+'/status', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status: 'SHIPPED', trackingNo: tracking })
    });
    document.getElementById('ship-modal').classList.add('hidden');
    loadOrders();
  });

  async function cancelOrder(id) {
    if (!confirm('确认取消该订单？')) return;
    await fetch('/api/plugin/ecommerce/orders/'+id+'/status', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'CANCELLED'}) });
    loadOrders();
  }

  async function completeOrder(id) {
    if (!confirm('确认完成该订单？')) return;
    await fetch('/api/plugin/ecommerce/orders/'+id+'/status', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'COMPLETED'}) });
    loadOrders();
  }

  function statusLabel(s) { var m={PENDING:'待支付',PAID:'已支付',SHIPPED:'已发货',COMPLETED:'已完成',CANCELLED:'已取消'}; return m[s]||s; }
  function statusClass(s) { var c={PAID:'bg-green-100 text-green-700',PENDING:'bg-yellow-100 text-yellow-700',SHIPPED:'bg-blue-100 text-blue-700',COMPLETED:'bg-green-100 text-green-700',CANCELLED:'bg-red-100 text-red-700'}; return c[s]||'bg-gray-100 text-gray-600'; }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  document.getElementById('tbl-body').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var action = btn.getAttribute('data-action');
    if (action === 'cancel') cancelOrder(id);
    else if (action === 'ship') openShip(id);
    else if (action === 'complete') completeOrder(id);
  });

  loadOrders();
</script>`;
};

export const afterSales: AdminRenderer = () => {
  return `
<div class="p-4">
  <h2 class="text-xl font-bold mb-4">售后管理</h2>

  <div class="flex gap-2 mb-4">
    <select id="status-filter" class="border rounded px-3 py-1.5 text-sm" onchange="loadData()">
      <option value="">全部状态</option>
      <option value="PENDING">待处理</option>
      <option value="PAID">已支付</option>
      <option value="PICKUP_SCHEDULED">待取件</option>
      <option value="IN_PROGRESS">处理中</option>
      <option value="COMPLETED">已完成</option>
    </select>
    <select id="type-filter" class="border rounded px-3 py-1.5 text-sm" onchange="loadData()">
      <option value="">全部类型</option>
      <option value="REPAIR">维修</option>
      <option value="RETURN">退货</option>
      <option value="EXCHANGE">换货</option>
      <option value="REFUND">退款</option>
    </select>
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-3 text-left w-16">类型</th>
          <th class="p-3 text-left">描述</th>
          <th class="p-3 text-left">联系人</th>
          <th class="p-3 text-left w-24">原价</th>
          <th class="p-3 text-left w-24">计费</th>
          <th class="p-3 text-left w-20">状态</th>
          <th class="p-3 text-left w-36">时间</th>
          <th class="p-3 text-right w-40">操作</th>
        </tr>
      </thead>
      <tbody id="tbl-body" class="divide-y"></tbody>
    </table>
  </div>

  <div class="mt-8 bg-white rounded-lg shadow p-4">
    <h3 class="font-bold mb-3">计价规则</h3>
    <table class="w-full text-sm" id="pricing-tbl">
      <thead class="bg-gray-50">
        <tr><th class="p-2 text-left">类型</th><th class="p-2 text-left">基础费(¥)</th><th class="p-2 text-left">费率(%)</th><th class="p-2 text-left w-16">启用</th><th class="p-2 text-right">操作</th></tr>
      </thead>
      <tbody class="divide-y"></tbody>
    </table>
    <button onclick="showRuleForm()" class="mt-3 px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">+ 添加/修改规则</button>
  </div>

  <div id="rule-form-modal" class="hidden fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl p-6 w-80">
      <h3 class="font-bold mb-4">计价规则</h3>
      <form id="rule-form" class="space-y-3">
        <select name="type" class="w-full border rounded px-3 py-1.5 text-sm">
          <option value="REPAIR">维修</option><option value="RETURN">退货</option><option value="EXCHANGE">换货</option><option value="REFUND">退款</option>
        </select>
        <div><label class="text-sm">基础费 ¥</label><input name="baseFee" type="number" step="0.01" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div><label class="text-sm">费率 (0.15 = 15%)</label><input name="rate" type="number" step="0.01" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="px-4 py-1.5 bg-blue-500 text-white rounded text-sm">保存</button>
          <button type="button" onclick="document.getElementById('rule-form-modal').classList.add('hidden')" class="px-4 py-1.5 border rounded text-sm">取消</button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
  async function loadData() {
    var status = document.getElementById('status-filter').value;
    var type = document.getElementById('type-filter').value;
    var params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);
    if (type) params.set('type', type);

    var r = await fetch('/api/plugin/ecommerce/after-sales?' + params);
    var orders = await r.json();
    document.getElementById('tbl-body').innerHTML = orders.map(function(o) {
      return '<tr class="hover:bg-gray-50"><td class="p-3"><span class="px-2 py-0.5 rounded text-xs bg-gray-100">'+typeLabel(o.type)+'</span></td>' +
        '<td class="p-3">'+esc(o.description||'-').slice(0,40)+'</td>' +
        '<td class="p-3 text-xs">'+esc(o.contactName||'-')+'<br/>'+esc(o.contactPhone||'')+(o.trackingNo?'<br/>📦 '+esc(o.trackingNo):'')+'</td>' +
        '<td class="p-3">¥'+(Number(o.originalPrice)||0).toFixed(2)+'</td>' +
        '<td class="p-3">¥'+(Number(o.calculatedFee)||0).toFixed(2)+'</td>' +
        '<td class="p-3"><span class="px-2 py-0.5 rounded text-xs '+statusClass(o.status)+'">'+statusLabel(o.status)+'</span></td>' +
        '<td class="p-3 text-xs text-gray-500">'+new Date(o.createdAt).toLocaleString('zh-CN')+'</td>' +
        '<td class="p-3 text-right">' +
          (o.status==='PENDING'?'<button data-action="updateStatus" data-id="'+esc(o.id)+'" data-status="IN_PROGRESS" class="text-blue-500 hover:underline text-xs">接单</button> ':'') +
          (o.status==='IN_PROGRESS'?'<button data-action="updateStatus" data-id="'+esc(o.id)+'" data-status="COMPLETED" class="text-green-500 hover:underline text-xs">完成</button>':'') +
          (o.status==='PAID'?'<button data-action="updateStatus" data-id="'+esc(o.id)+'" data-status="IN_PROGRESS" class="text-purple-500 hover:underline text-xs">处理</button>':'') +
        '</td></tr>';
    }).join('');

    // Pricing rules
    var pr = await fetch('/api/plugin/ecommerce/after-sales/pricing-rules');
    var rules = await pr.json();
    document.getElementById('pricing-tbl').querySelector('tbody').innerHTML = rules.map(function(r) {
      return '<tr class="hover:bg-gray-50"><td class="p-2">'+typeLabel(r.type)+'</td>' +
        '<td class="p-2">¥'+Number(r.baseFee).toFixed(2)+'</td>' +
        '<td class="p-2">'+(Number(r.rate)*100).toFixed(1)+'%</td>' +
        '<td class="p-2">'+(r.enabled!==0?'✅':'❌')+'</td>' +
        '<td class="p-2 text-right"><button data-action="editRule" data-type="'+esc(r.type)+'" data-base="'+r.baseFee+'" data-rate="'+r.rate+'" class="text-blue-500 hover:underline text-xs">编辑</button></td></tr>';
    }).join('');
  }

  async function updateStatus(id, status) {
    await fetch('/api/plugin/ecommerce/after-sales/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:status}) });
    loadData();
  }

  function showRuleForm() { document.getElementById('rule-form-modal').classList.remove('hidden'); document.getElementById('rule-form').reset(); }
  function editRule(type, fee, rate) {
    document.getElementById('rule-form-modal').classList.remove('hidden');
    var f = document.getElementById('rule-form');
    f.type.value = type; f.baseFee.value = fee; f.rate.value = rate;
  }

  document.getElementById('rule-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(e.target));
    await fetch('/api/plugin/ecommerce/after-sales/pricing-rules', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({type:data.type, baseFee:parseFloat(data.baseFee)||0, rate:parseFloat(data.rate)||0}),
    });
    document.getElementById('rule-form-modal').classList.add('hidden');
    loadData();
  });

  function typeLabel(t) { var m={REPAIR:'维修',RETURN:'退货',EXCHANGE:'换货',REFUND:'退款'}; return m[t]||t; }
  function statusLabel(s) { var m={PENDING:'待处理',PAID:'已支付',PICKUP_SCHEDULED:'待取件',IN_PROGRESS:'处理中',COMPLETED:'已完成',CANCELLED:'已取消'}; return m[s]||s; }
  function statusClass(s) { var c={PENDING:'bg-yellow-100 text-yellow-700',PAID:'bg-blue-100 text-blue-700',PICKUP_SCHEDULED:'bg-purple-100 text-purple-700',IN_PROGRESS:'bg-indigo-100 text-indigo-700',COMPLETED:'bg-green-100 text-green-700'}; return c[s]||'bg-gray-100 text-gray-600'; }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  document.getElementById('tbl-body').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action="updateStatus"]');
    if (btn) updateStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status'));
  });

  document.getElementById('pricing-tbl').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action="editRule"]');
    if (btn) {
      var type = btn.getAttribute('data-type');
      var base = parseFloat(btn.getAttribute('data-base')||'0');
      var rate = parseFloat(btn.getAttribute('data-rate')||'0');
      editRule(type, base, rate);
    }
  });

  loadData();
</script>`;
};

export const payment: AdminRenderer = () => {
  return `
<div class="p-4 max-w-2xl">
  <h2 class="text-xl font-bold mb-4">💳 支付设置</h2>

  <div class="bg-white rounded-lg shadow p-4">
    <form id="payment-config-form" class="space-y-4">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium">启用支付</label>
        <input type="checkbox" name="paymentEnabled" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">AppID</label>
        <input name="appId" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="wx..." />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">商户号 (mchId)</label>
        <input name="mchId" class="w-full border rounded px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">API v3 密钥</label>
        <input name="apiV3Key" type="password" class="w-full border rounded px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">证书序列号</label>
        <input name="serialNo" class="w-full border rounded px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">商户私钥路径</label>
        <input name="privateKeyPath" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="/etc/wechatpay/apiclient_key.pem" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">回调通知 URL</label>
        <input name="notifyUrl" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="https://your-site.com/api/plugin/ecommerce/payment/notify" />
      </div>
    </form>
  </div>

  <div class="mt-4 bg-white rounded-lg shadow p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold">当前配置</h3>
      <button onclick="testConnection()" class="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">🔍 测试连接</button>
    </div>
    <div id="current-config" class="text-sm text-gray-600"></div>
    <div id="test-result" class="mt-2 text-sm"></div>
  </div>
</div>

<script>
  async function loadConfig() {
    var r = await fetch('/api/plugin/ecommerce/payment/config');
    var cfg = await r.json();
    var form = document.getElementById('payment-config-form');
    form.paymentEnabled.checked = !!cfg.enabled;
    form.appId.value = cfg.appId || '';
    form.mchId.value = cfg.mchId || '';
    form.serialNo.value = cfg.serialNo || '';
    form.privateKeyPath.value = cfg.privateKeyPath !== '***已设置***' ? (cfg.privateKeyPath||'') : '';
    form.notifyUrl.value = cfg.notifyUrl || '';
    document.getElementById('current-config').innerHTML =
      '<p>渠道: '+esc(cfg.provider||'wechat')+'</p>' +
      '<p>AppID: '+esc(cfg.appId||'-')+'</p>' +
      '<p>商户号: '+esc(cfg.mchId||'-')+'</p>' +
      '<p>证书序列号: '+esc(cfg.serialNo||'-')+'</p>' +
      '<p>私钥: '+(cfg.privateKeyPath||'-')+'</p>' +
      '<p>回调URL: '+esc(cfg.notifyUrl||'-')+'</p>';
  }

  async function testConnection() {
    document.getElementById('test-result').innerHTML = '<span class="text-blue-500">测试中...</span>';
    try {
      var r = await fetch('/api/plugin/ecommerce/payment/test', { method:'POST' });
      var d = await r.json();
      document.getElementById('test-result').innerHTML = d.ok
        ? '<span class="text-green-600">✅ '+esc(d.message)+'</span>'
        : '<span class="text-red-500">❌ '+esc(d.message)+'</span>';
    } catch(e) {
      document.getElementById('test-result').innerHTML = '<span class="text-red-500">❌ 请求失败</span>';
    }
  }

  document.getElementById('payment-config-form').addEventListener('change', async function() {
    var form = document.getElementById('payment-config-form');
    var data = {};
    ['appId','mchId','serialNo','privateKeyPath','notifyUrl'].forEach(function(k) {
      if (form[k].value) data[k] = form[k].value;
    });
    data.paymentEnabled = form.paymentEnabled.checked;
    if (form.apiV3Key.value) data.apiV3Key = form.apiV3Key.value;
    await fetch('/api/plugin/ecommerce/payment/config', {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
    });
  });

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  loadConfig();
</script>`;
};
