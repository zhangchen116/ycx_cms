import type { SessionPayload } from "@/lib/auth";

type AdminRenderer = (session: SessionPayload) => string;

export const productsList: AdminRenderer = () => {
  return `
<div class="p-4">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">商品管理</h2>
    <div class="flex gap-2">
      <button id="batch-publish-btn" class="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 hidden">批量上架</button>
      <button id="batch-draft-btn" class="px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 hidden">批量下架</button>
      <button id="batch-delete-btn" class="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 hidden">批量删除</button>
      <button onclick="window.location.href='/admin/plugin/ecommerce/products/edit'" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">+ 新建商品</button>
    </div>
  </div>

  <div class="flex gap-2 mb-4">
    <input id="search-input" type="text" placeholder="搜索商品..." class="flex-1 border rounded px-3 py-1.5 text-sm" />
    <select id="status-filter" class="border rounded px-3 py-1.5 text-sm">
      <option value="">全部状态</option>
      <option value="PUBLISHED">已上架</option>
      <option value="DRAFT">草稿</option>
      <option value="SOLD">已售</option>
    </select>
    <select id="category-filter" class="border rounded px-3 py-1.5 text-sm">
      <option value="">全部分类</option>
    </select>
    <button onclick="loadProducts()" class="px-4 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200">刷新</button>
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-3 text-left w-10"><input type="checkbox" id="select-all" onchange="toggleSelectAll()" /></th>
          <th class="p-3 text-left w-12">图</th>
          <th class="p-3 text-left">标题</th>
          <th class="p-3 text-left w-24">价格</th>
          <th class="p-3 text-left w-20">库存</th>
          <th class="p-3 text-left w-20">状态</th>
          <th class="p-3 text-left w-20">显隐</th>
          <th class="p-3 text-right w-24">操作</th>
        </tr>
      </thead>
      <tbody id="tbl-body" class="divide-y"></tbody>
    </table>
  </div>
</div>

<script>
  var allCategories = [], selectedIds = new Set();

  async function loadCategories() {
    var r = await fetch('/api/plugin/ecommerce/products/categories');
    allCategories = await r.json();
    var sel = document.getElementById('category-filter');
    allCategories.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  function getFirstImage(raw) {
    try { var arr = typeof raw==='string' ? JSON.parse(raw) : (raw||[]); return arr.length?arr[0]:''; } catch(e) { return ''; }
  }

  async function loadProducts() {
    var q = document.getElementById('search-input').value;
    var status = document.getElementById('status-filter').value;
    var categoryId = document.getElementById('category-filter').value;
    var params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    params.set('limit', '200');

    var r = await fetch('/api/plugin/ecommerce/products?' + params);
    var products = await r.json();
    var tbody = document.getElementById('tbl-body');
    tbody.innerHTML = products.map(function(p, i) {
      var img = getFirstImage(p.images);
      return '<tr class="hover:bg-gray-50">' +
        '<td class="p-3"><input type="checkbox" value="'+p.id+'" onchange="onSelect()" class="product-checkbox" /></td>' +
        '<td class="p-3">'+(img?'<img src="'+esc(img)+'" class="w-10 h-10 object-cover rounded" />':'<div class="w-10 h-10 bg-gray-100 rounded"></div>')+'</td>' +
        '<td class="p-3 font-medium">'+esc(p.title)+'</td>' +
        '<td class="p-3">'+(p.originalPrice?'<span class="text-xs text-gray-400 line-through">¥'+Number(p.originalPrice).toFixed(2)+'</span> ':'')+'<span>¥'+Number(p.price).toFixed(2)+'</span></td>' +
        '<td class="p-3 '+(p.stock<=0?'text-red-500':'')+'">'+(p.stock||0)+'</td>' +
        '<td class="p-3"><span class="px-2 py-0.5 rounded text-xs '+statusClass(p.status)+'">'+statusLabel(p.status)+'</span></td>' +
        '<td class="p-3"><span class="text-xs '+(p.visibility==='HIDDEN'?'text-red-500':'text-green-600')+'">'+(p.visibility==='HIDDEN'?'隐藏':'可见')+'</span></td>' +
        '<td class="p-3 text-right">' +
          '<a href="/admin/plugin/ecommerce/products/edit?id='+p.id+'" class="text-blue-500 hover:underline">编辑</a>' +
          '<button data-action="delete" data-id="'+esc(p.id)+'" class="text-red-500 hover:underline ml-2">删除</button>' +
        '</td></tr>';
    }).join('');
  }

  function toggleSelectAll() {
    var checked = document.getElementById('select-all').checked;
    document.querySelectorAll('.product-checkbox').forEach(function(cb) { cb.checked = checked; });
    onSelect();
  }

  function onSelect() {
    selectedIds.clear();
    document.querySelectorAll('.product-checkbox:checked').forEach(function(cb) { selectedIds.add(cb.value); });
    var show = selectedIds.size > 0;
    ['batch-publish-btn','batch-draft-btn','batch-delete-btn'].forEach(function(id) {
      document.getElementById(id).classList.toggle('hidden', !show);
    });
  }

  document.getElementById('batch-publish-btn').addEventListener('click', function() {
    batchAction('status','PUBLISHED');
  });
  document.getElementById('batch-draft-btn').addEventListener('click', function() {
    batchAction('status','DRAFT');
  });
  document.getElementById('batch-delete-btn').addEventListener('click', function() {
    if (!confirm('确认删除选中的 '+selectedIds.size+' 个商品？')) return;
    batchAction('delete', null);
  });

  async function batchAction(action, value) {
    await fetch('/api/plugin/ecommerce/products/batch', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ids: Array.from(selectedIds), action: action, value: value })
    });
    selectedIds.clear();
    loadProducts();
    onSelect();
  }

  async function deleteProduct(id) {
    if (!confirm('确认删除该商品？')) return;
    await fetch('/api/plugin/ecommerce/products/' + id, { method: 'DELETE' });
    loadProducts();
  }

  function statusLabel(s) { var m={DRAFT:'草稿',PUBLISHED:'上架',SOLD:'已售'}; return m[s]||s; }
  function statusClass(s) { return s==='PUBLISHED'?'bg-green-100 text-green-700':s==='DRAFT'?'bg-gray-100 text-gray-600':'bg-red-100 text-red-700'; }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  document.getElementById('tbl-body').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action="delete"]');
    if (btn) deleteProduct(btn.getAttribute('data-id'));
  });

  loadCategories();
  loadProducts();
</script>`;
};

export const productsEdit: AdminRenderer = () => {
  return `
<div class="p-4">
  <div class="flex items-center gap-4 mb-4">
    <a href="/admin/plugin/ecommerce/products" class="text-gray-500 hover:text-gray-700">← 返回</a>
    <h2 class="text-xl font-bold" id="page-title">编辑商品</h2>
  </div>

  <div class="bg-white rounded-lg shadow p-4">
    <!-- Tab 切换 -->
    <div class="flex border-b mb-4" id="tabs">
      <button class="px-4 py-2 text-sm border-b-2 border-blue-500 text-blue-600" data-tab="basic">基本信息</button>
      <button class="px-4 py-2 text-sm text-gray-500" data-tab="price">价格库存</button>
      <button class="px-4 py-2 text-sm text-gray-500" data-tab="attrs">商品属性</button>
      <button class="px-4 py-2 text-sm text-gray-500" data-tab="images">商品图片</button>
      <button class="px-4 py-2 text-sm text-gray-500" data-tab="content">详情页HTML</button>
    </div>

    <form id="product-form" class="space-y-4 max-w-2xl">
      <!-- Tab 1: 基本信息 -->
      <div id="tab-basic">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">标题 *</label>
            <input name="title" required class="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Slug</label>
            <input name="slug" class="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 mt-3">描述</label>
          <textarea name="description" rows="3" class="w-full border rounded px-3 py-1.5 text-sm"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 mt-3">标签（逗号分隔）</label>
            <input name="tags" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="新品,热卖,限时" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 mt-3">商品分类</label>
            <select name="categoryId" id="category-select" class="w-full border rounded px-3 py-1.5 text-sm"><option value="">无</option></select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 mt-3">状态</label>
            <select name="status" class="w-full border rounded px-3 py-1.5 text-sm">
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已上架</option>
              <option value="SOLD">已售</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 mt-3">显隐</label>
            <select name="visibility" class="w-full border rounded px-3 py-1.5 text-sm">
              <option value="VISIBLE">可见</option>
              <option value="HIDDEN">隐藏</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Tab 2: 价格库存 -->
      <div id="tab-price" class="hidden">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium mb-1">售价 ¥ *</label><input name="price" type="number" step="0.01" required class="w-full border rounded px-3 py-1.5 text-sm" /></div>
          <div><label class="block text-sm font-medium mb-1">原价 ¥（划线价）</label><input name="originalPrice" type="number" step="0.01" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div><label class="block text-sm font-medium mb-1 mt-3">库存</label><input name="stock" type="number" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
          <div><label class="block text-sm font-medium mb-1 mt-3">商品编号</label><input name="productCode" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
          <div><label class="block text-sm font-medium mb-1 mt-3">SKU</label><input name="sku" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium mb-1 mt-3">数量</label><input name="quantity" type="number" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
          <div><label class="block text-sm font-medium mb-1 mt-3">排序</label><input name="sort" type="number" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 mt-3">支付方式</label>
            <select name="paymentMode" class="w-full border rounded px-3 py-1.5 text-sm">
              <option value="wechat">微信支付</option>
              <option value="link">外部链接跳转</option>
            </select>
          </div>
          <div id="buy-link-group" class="hidden">
            <label class="block text-sm font-medium mb-1 mt-3">购买链接</label>
            <input name="buyLink" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="https://..." />
          </div>
        </div>
      </div>

      <!-- Tab 3: 商品属性 -->
      <div id="tab-attrs" class="hidden">
        <div id="attr-values"></div>
      </div>

      <!-- Tab 4: 商品图片 -->
      <div id="tab-images" class="hidden">
        <label class="block text-sm font-medium mb-2">商品图片</label>
        <div id="images-container" class="grid grid-cols-4 gap-2"></div>
        <div class="mt-2">
          <button type="button" onclick="addImage()" class="px-3 py-1 border rounded text-sm hover:bg-gray-50">+ 添加图片</button>
        </div>
      </div>

      <!-- Tab 5: 详情页内容 -->
      <div id="tab-content" class="hidden">
        <label class="block text-sm font-medium mb-2">详情页 HTML 内容</label>
        <textarea name="content" rows="12" class="w-full border rounded px-3 py-1.5 text-sm font-mono" placeholder="<h2>商品介绍</h2><p>...</p>"></textarea>
      </div>

      <div class="pt-4">
        <button type="submit" class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
        <button type="button" onclick="history.back()" class="px-6 py-2 border rounded ml-2">取消</button>
      </div>
    </form>
  </div>
</div>

<script>
  var urlParams = new URLSearchParams(window.location.search);
  var productId = urlParams.get('id');
  document.getElementById('page-title').textContent = productId ? '编辑商品' : '新建商品';

  // Tab 切换
  document.getElementById('tabs').addEventListener('click', function(e) {
    if (e.target.tagName !== 'BUTTON') return;
    var tab = e.target.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(function(b) {
      b.className = 'px-4 py-2 text-sm ' + (b.dataset.tab===tab?'border-b-2 border-blue-500 text-blue-600':'text-gray-500');
    });
    document.querySelectorAll('[id^="tab-"]').forEach(function(el) { el.classList.add('hidden'); });
    document.getElementById('tab-' + tab).classList.remove('hidden');
  });

  var imageCount = 0;
  window.addImage = function() {
    var container = document.getElementById('images-container');
    var i = imageCount++;
    container.innerHTML += '<div class="relative border rounded p-1" id="img-'+i+'">' +
      '<input name="img_'+i+'" class="w-full border rounded px-2 py-1 text-sm mb-1" placeholder="图片URL" />' +
      '<button type="button" data-action="remove-img" data-id="'+i+'" class="absolute top-1 right-1 text-red-500 text-xs">✕</button>' +
      '</div>';
  };

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/'/g,'&#39;'); }

  document.getElementById('images-container').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action="remove-img"]');
    if (btn) document.getElementById('img-'+btn.getAttribute('data-id')).remove();
  });

  async function init() {
    // Categories
    var cr = await fetch('/api/plugin/ecommerce/products/categories');
    var cats = await cr.json();
    var sel = document.getElementById('category-select');
    cats.forEach(function(c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

    // Attribute templates
    var ar = await fetch('/api/plugin/ecommerce/attributes');
    var templates = await ar.json();
    var attrDiv = document.getElementById('attr-values');
    templates.forEach(function(t) {
      var label = document.createElement('label');
      label.className = 'block text-xs text-gray-500 mt-2';
      label.textContent = t.name;
      attrDiv.appendChild(label);
      if (t.attrValues && t.attrValues.length > 0) {
        var select = document.createElement('select');
        select.name = 'attr_' + t.id;
        select.className = 'w-full border rounded px-3 py-1.5 text-sm';
        select.innerHTML = '<option value="">未设置</option>' + t.attrValues.map(function(v){return '<option value="'+escAttr(v)+'">'+esc(v)+'</option>';}).join('');
        attrDiv.appendChild(select);
      } else {
        var input = document.createElement('input');
        input.type = 'text'; input.name = 'attr_' + t.id;
        input.className = 'w-full border rounded px-3 py-1.5 text-sm';
        attrDiv.appendChild(input);
      }
    });

    // Payment mode toggle
    var modeSel = document.querySelector('select[name="paymentMode"]');
    function toggleBuyLink() { document.getElementById('buy-link-group').className = modeSel.value==='link' ? '' : 'hidden'; }
    modeSel.addEventListener('change', toggleBuyLink);
    toggleBuyLink();

    // Load existing product
    if (productId) {
      var r = await fetch('/api/plugin/ecommerce/products/' + productId);
      if (r.ok) {
        var p = await r.json();
        var form = document.getElementById('product-form');
        for (var _i = 0; _i < form.elements.length; _i++) {
          var el = form.elements[_i];
          if (p[el.name] !== undefined) {
            if (el.type === 'checkbox') el.checked = !!p[el.name];
            else el.value = p[el.name] ?? '';
          }
        }
        if (p.category) form.elements['categoryId'].value = p.category.id;
        if (p.attributes && Array.isArray(p.attributes)) {
          p.attributes.forEach(function(av) {
            var el = form.elements['attr_' + av.templateId];
            if (el) el.value = av.attrValue;
          });
        }
        // 加载已有图片
        if (p.images && p.images.length) {
          p.images.forEach(function(url) {
            var container = document.getElementById('images-container');
            var i = imageCount++;
            container.innerHTML = '<div class="relative border rounded p-1" id="img-'+i+'">' +
              '<input name="img_'+i+'" value="'+escAttr(url)+'" class="w-full border rounded px-2 py-1 text-sm mb-1" />' +
              '<button type="button" data-action="remove-img" data-id="'+i+'" class="absolute top-1 right-1 text-red-500 text-xs">✕</button>' +
              '</div>' + container.innerHTML;
          });
        }
        toggleBuyLink();
      }
    }
  }

  document.getElementById('product-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var form = e.target;
    var data = Object.fromEntries(new FormData(form));

    // Parse numeric fields
    ['price','originalPrice','stock','quantity','sort'].forEach(function(k) {
      data[k] = parseFloat(data[k]) || 0;
    });

    // Collect images
    var images = [];
    for (var _i = 0; _i < imageCount; _i++) {
      if (form.elements['img_'+_i] && form.elements['img_'+_i].value) {
        images.push(form.elements['img_'+_i].value);
      }
    }
    data.images = images;

    // Collect attributes
    var attributeValues = [];
    for (var key in data) {
      if (key.startsWith('attr_') && data[key]) {
        attributeValues.push({ templateId: key.replace('attr_',''), attrValue: data[key] });
      }
      if (key.startsWith('attr_') || key.startsWith('img_')) delete data[key];
    }
    data.attributeValues = attributeValues;
    if (!data.aiGenerated) delete data.aiGenerated;

    var method = productId ? 'PUT' : 'POST';
    var url = productId ? '/api/plugin/ecommerce/products/' + productId : '/api/plugin/ecommerce/products';
    var r = await fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (r.ok) {
      window.location.href = '/admin/plugin/ecommerce/products';
    } else {
      var err = await r.json();
      alert(err.error || '保存失败');
    }
  });

  init();
</script>`;
};

export const attributes: AdminRenderer = () => {
  return `
<div class="p-4">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">属性模板</h2>
    <button onclick="showCreateForm()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">+ 新建属性</button>
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-3 text-left">名称</th>
          <th class="p-3 text-left">Slug</th>
          <th class="p-3 text-left">可选值</th>
          <th class="p-3 text-left w-24">可筛选</th>
          <th class="p-3 text-left w-16">排序</th>
          <th class="p-3 text-right w-24">操作</th>
        </tr>
      </thead>
      <tbody id="tbl-body" class="divide-y"></tbody>
    </table>
  </div>

  <div id="edit-form" class="hidden fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl p-6 w-96">
      <h3 class="font-bold mb-4" id="form-title">新建属性</h3>
      <form id="attr-form" class="space-y-3">
        <input type="hidden" name="id" />
        <div><label class="block text-sm mb-1">名称</label><input name="name" required class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div><label class="block text-sm mb-1">Slug</label><input name="slug" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div><label class="block text-sm mb-1">可选值（逗号分隔）</label><input name="attrValues" class="w-full border rounded px-3 py-1.5 text-sm" /></div>
        <div class="flex items-center gap-3">
          <label class="text-sm"><input type="checkbox" name="filterable" /> 支持筛选</label>
          <label class="text-sm">排序 <input name="sort" type="number" class="border rounded px-2 py-0.5 w-16 text-sm" /></label>
        </div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="px-4 py-1.5 bg-blue-500 text-white rounded text-sm">保存</button>
          <button type="button" onclick="hideForm()" class="px-4 py-1.5 border rounded text-sm">取消</button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
  function showCreateForm() {
    document.getElementById('form-title').textContent = '新建属性';
    document.getElementById('attr-form').reset();
    document.getElementById('edit-form').classList.remove('hidden');
  }
  function hideForm() { document.getElementById('edit-form').classList.add('hidden'); }

  async function loadTemplates() {
    var r = await fetch('/api/plugin/ecommerce/attributes');
    var templates = await r.json();
    document.getElementById('tbl-body').innerHTML = templates.map(function(t) {
      return '<tr class="hover:bg-gray-50"><td class="p-3 font-medium">'+esc(t.name)+'</td>' +
        '<td class="p-3 text-xs text-gray-500">'+esc(t.slug)+'</td>' +
        '<td class="p-3 text-xs text-gray-500">'+(t.attrValues||[]).join(', ')+'</td>' +
        '<td class="p-3">'+(t.filterable?'✅':'❌')+'</td><td class="p-3 text-gray-400">'+(t.sort||0)+'</td>' +
        '<td class="p-3 text-right"><button data-action="edit" data-id="'+esc(t.id)+'" class="text-blue-500 hover:underline">编辑</button>' +
        '<button data-action="delete" data-id="'+esc(t.id)+'" class="text-red-500 hover:underline ml-2">删除</button></td></tr>';
    }).join('');
  }

  document.getElementById('tbl-body').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-action') === 'edit') editTemplate(id);
    else if (btn.getAttribute('data-action') === 'delete') deleteTemplate(id);
  });

  function editTemplate(id) {
    var r = fetch('/api/plugin/ecommerce/attributes').then(function(r){return r.json();}).then(function(ts) {
      var t = ts.find(function(x){return x.id===id;});
      if (!t) return;
      document.getElementById('form-title').textContent = '编辑属性';
      var f = document.getElementById('attr-form');
      f.id.value = t.id; f.name.value = t.name; f.slug.value = t.slug;
      f.attrValues.value = (t.attrValues||[]).join(', ');
      f.filterable.checked = !!t.filterable; f.sort.value = t.sort||0;
      document.getElementById('edit-form').classList.remove('hidden');
    });
  }

  async function deleteTemplate(id) {
    if (!confirm('确认删除？')) return;
    await fetch('/api/plugin/ecommerce/attributes/' + id, { method: 'DELETE' });
    loadTemplates();
  }

  document.getElementById('attr-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var f = e.target;
    var data = { name:f.name.value, slug:f.slug.value, filterable:f.filterable.checked, sort:parseInt(f.sort.value)||0 };
    data.attrValues = f.attrValues.value ? f.attrValues.value.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
    var id = f.id.value, method = id?'PUT':'POST', url = id?'/api/plugin/ecommerce/attributes/'+id:'/api/plugin/ecommerce/attributes';
    await fetch(url, { method:method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    hideForm(); loadTemplates();
  });

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  loadTemplates();
</script>`;
};
