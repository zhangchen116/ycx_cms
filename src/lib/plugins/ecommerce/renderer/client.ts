/**
 * 电商插件前端水合 JS
 * 注入到页面底部，为所有 7 个占位符组件做数据拉取和交互绑定。
 *
 * 结构：每个占位符独立的水合函数 + 共享工具函数，按选择器触发。
 */
export function clientJS(): string {
  return `<script>(function() {
  "use strict";
  var API = "/api/plugin/ecommerce";

  // ═══ 工具函数 ═══
  function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function el(id) { return document.getElementById(id); }
  function fmtPrice(p) { return (Number(p)||0).toFixed(2); }

  var COL_CLASSES = {
    "2": "grid-cols-1 sm:grid-cols-2",
    "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  };

  function statusLabel(s) {
    var m = {DRAFT:"草稿",PUBLISHED:"上架",SOLD:"已售",PENDING:"待支付",PAID:"已支付",SHIPPED:"已发货",COMPLETED:"已完成",CANCELLED:"已取消",EXPIRED:"已过期"};
    return m[s]||s;
  }

  // ═══ 1. product-card 水合 ═══
  function hydrateProductCards() {
    var cards = document.querySelectorAll("[data-cms-plugin='product-card']");
    cards.forEach(function(card) {
      if (card.dataset.hydrated) return;
      card.dataset.hydrated = "1";
      var pid = card.getAttribute("data-product-id");
      var showPrice = card.getAttribute("data-show-price") !== "false";
      var showBadge = card.getAttribute("data-show-badge") !== "false";
      if (!pid) { card.innerHTML = '<div class="text-red-500 text-sm p-4">缺少 data-product-id</div>'; return; }

      fetch(API + "/products/" + pid).then(function(r) { return r.json(); }).then(function(p) {
        if (p.error) { card.innerHTML = '<div class="text-gray-400 text-sm p-4">商品不存在</div>'; return; }
        var rawImgs = typeof p.images==="string" ? JSON.parse(p.images||"[]") : (p.images||[]);
        var imgUrl = (rawImgs.length ? rawImgs[0] : "") || "";
        var imgHtml = imgUrl ? '<img src="'+esc(imgUrl)+'" alt="'+esc(p.title)+'" class="w-full h-48 object-cover" />'
                             : '<div class="h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">暂无图片</div>';

        card.innerHTML = '<div class="cms-product-card-inner bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">' +
          '<div class="cms-product-card-image">' + imgHtml +
          (showBadge && p.status==="PUBLISHED" ? '<span class="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded">新品</span>' : '') +
          '</div>' +
          '<div class="p-3">' +
          '<a class="cms-product-card-title text-sm font-medium line-clamp-2 hover:text-blue-600" href="/product/'+esc(p.slug)+'" style="display:block;min-height:2.5rem">'+esc(p.title)+'</a>' +
          (showPrice ? '<div class="mt-2 flex items-center justify-between"><div><span class="cms-product-card-price text-red-500 font-bold">¥'+fmtPrice(p.price)+'</span>'+(p.originalPrice>0 ? '<span class="text-xs text-gray-400 line-through ml-1">¥'+fmtPrice(p.originalPrice)+'</span>' : '')+'</div>'+
          (p.status==="PUBLISHED" && p.stock>0 ? '<button class="cms-product-card-buy px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600" onclick="window.__ecomBuy(\''+p.id+'\')">购买</button>'
          : p.status==="SOLD" ? '<button class="cms-product-card-buy px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600" onclick="window.location.href=\'/after-sales?product='+p.id+'\'">申请售后</button>'
          : '<span class="text-xs text-gray-400">'+statusLabel(p.status)+'</span>')+'</div>'
          : '') +
          '</div></div>';
      }).catch(function(err) {
        card.innerHTML = '<div class="text-red-500 text-sm p-4">加载失败</div>';
        console.error("[ecommerce] product-card hydrate:", err);
      });
    });
  }

  // ═══ 2. product-grid 水合（SSR 模式） ═══
  function hydrateProductGrids() {
    var grids = document.querySelectorAll("[data-cms-plugin='product-grid']");
    grids.forEach(function(gridDiv) {
      if (gridDiv.dataset.hydrated) return;
      gridDiv.dataset.hydrated = "1";
      var cols = gridDiv.getAttribute("data-cols")||"3";
      var category = gridDiv.getAttribute("data-category")||"";
      var limit = gridDiv.getAttribute("data-limit")||"12";
      var order = gridDiv.getAttribute("data-order")||"desc";
      var showFilters = gridDiv.getAttribute("data-show-filters")==="true";
      var gridId = gridDiv.id;
      var filterContainer = el(gridId+"-filter");
      var gridContainer = el(gridId+"-grid");
      var gridClass = COL_CLASSES[cols]||COL_CLASSES["3"];

      // 存储筛选状态
      var activeFilters = {};
      var filterSelects = {};

      function buildUrl() {
        var params = new URLSearchParams();
        if (category) params.set("categoryId", category);
        params.set("limit", limit);
        params.set("order", order);
        params.set("status", "PUBLISHED");
        Object.keys(activeFilters).forEach(function(templateSlug) {
          if (activeFilters[templateSlug]) {
            params.append("attr_"+templateSlug, activeFilters[templateSlug]);
          }
        });
        return API + "/products?" + params.toString();
      }

      function renderCard(p) {
        var rawImgs = typeof p.images==="string" ? JSON.parse(p.images||"[]") : (p.images||[]);
        var imgUrl = (rawImgs.length ? rawImgs[0] : "") || "";
        var imgHtml = imgUrl ? '<img src="'+esc(imgUrl)+'" alt="'+esc(p.title)+'" class="w-full h-48 object-cover" loading="lazy" />'
                             : '<div class="h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">暂无图片</div>';
        return '<div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">' +
          '<div>'+imgHtml+'</div>' +
          '<div class="p-3">' +
          '<a class="text-sm font-medium line-clamp-2 hover:text-blue-600 block" href="/product/'+esc(p.slug)+'" style="min-height:2.5rem">'+esc(p.title)+'</a>' +
          '<div class="mt-2 flex items-center justify-between">' +
          '<div><span class="text-red-500 font-bold">¥'+fmtPrice(p.price)+'</span>'+(p.originalPrice>0 ? '<span class="text-xs text-gray-400 line-through ml-1">¥'+fmtPrice(p.originalPrice)+'</span>' : '')+'</div>' +
          (p.stock>0 ? '<button class="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600" onclick="window.__ecomBuy(\''+p.id+'\')">购买</button>' : '<span class="text-xs text-gray-400">缺货</span>')+
          '</div></div></div>';
      }

      function loadProducts() {
        if (gridContainer) gridContainer.innerHTML = '<div class="text-gray-400 text-sm p-8 text-center col-span-full">加载中...</div>';
        fetch(buildUrl()).then(function(r) { return r.json(); }).then(function(products) {
          if (!gridContainer) return;
          if (!Array.isArray(products) || products.length===0) {
            gridContainer.innerHTML = '<div class="text-gray-400 text-sm p-8 text-center col-span-full">暂无商品</div>';
            return;
          }
          gridContainer.className = gridClass + " gap-4";
          gridContainer.innerHTML = products.map(renderCard).join("");

          // SSR模式：同步URL query
          if (showFilters && Object.keys(activeFilters).length > 0) {
            var url = new URL(window.location.href);
            Object.keys(activeFilters).forEach(function(k) {
              if (activeFilters[k]) url.searchParams.set("attr_"+k, activeFilters[k]);
              else url.searchParams.delete("attr_"+k);
            });
            if (history.replaceState) history.replaceState(null,"",url);
          }
        }).catch(function(err) {
          if (gridContainer) gridContainer.innerHTML = '<div class="text-red-500 text-sm p-8 text-center col-span-full">加载失败</div>';
          console.error("[ecommerce] product-grid load:", err);
        });
      }

      // 构建筛选栏
      if (showFilters && filterContainer) {
        fetch(API + "/products/categories?path=" + (category||"")).then(function(r) { return r.json(); }).then(function(cats) {
          var activeCategoryId = "";
          if (category && cats.length) {
            var found = cats.find(function(c) { return c.slug === category; });
            if (found) activeCategoryId = found.id;
          }
          fetch(API + "/attributes/filter-options" + (activeCategoryId ? "?categoryId="+activeCategoryId : ""))
            .then(function(r) { return r.json(); }).then(function(options) {
              if (!options.length) return;
              filterContainer.innerHTML = "";
              options.forEach(function(opt) {
                var select = document.createElement("select");
                select.className = "border rounded px-2 py-1 text-sm";
                select.innerHTML = '<option value="">全部'+esc(opt.name)+'</option>' +
                  opt.values.map(function(v) { return '<option value="'+esc(v)+'">'+esc(v)+'</option>'; }).join("");
                filterContainer.appendChild(select);
                filterSelects[opt.slug] = select;

                select.addEventListener("change", function() {
                  activeFilters[opt.slug] = select.value;
                  loadProducts();
                  // 广播联动 product-filter
                  document.querySelectorAll("[data-cms-plugin='product-filter']").forEach(function(f) {
                    if (f.dataset.target==="#"+gridId || !f.dataset.target) {
                      var sels = f.querySelectorAll("select");
                      sels.forEach(function(s) { if (s.getAttribute("data-attr-slug")===opt.slug) s.value = select.value; });
                    }
                  });
                });
              });
            });
        }).catch(function() {});
      }

      loadProducts();
    });
  }

  // ═══ 3. buy-button 水合 ═══
  function hydrateBuyButtons() {
    var buttons = document.querySelectorAll("[data-cms-plugin='buy-button']");
    buttons.forEach(function(btnDiv) {
      if (btnDiv.dataset.hydrated) return;
      btnDiv.dataset.hydrated = "1";
      var pid = btnDiv.getAttribute("data-product-id");
      var text = btnDiv.getAttribute("data-text")||"立即购买";
      var style = btnDiv.getAttribute("data-style")||"primary";
      if (!pid) { btnDiv.innerHTML = '<span class="text-red-500 text-xs">缺少 data-product-id</span>'; return; }

      var cls = style==="outline" ? "border border-blue-500 text-blue-500 bg-white hover:bg-blue-50" : "bg-blue-500 text-white hover:bg-blue-600";

      fetch(API+"/products/"+pid).then(function(r){return r.json();}).then(function(p) {
        if (p.error) { btnDiv.innerHTML = '<span class="text-gray-400 text-xs">商品不存在</span>'; return; }

        function renderBtn(label, disabled, onClick, extraCls) {
          var b = document.createElement("button");
          b.className = "cms-buy-btn rounded transition-colors px-5 py-2 text-sm " + cls + (extraCls?" "+extraCls:"");
          b.textContent = label;
          b.disabled = !!disabled;
          if (onClick) b.onclick = onClick;
          btnDiv.innerHTML = "";
          btnDiv.appendChild(b);
        }

        if (p.visibility === "HIDDEN") {
          btnDiv.innerHTML = ""; // 不渲染
        } else if (p.status === "SOLD") {
          renderBtn("申请售后", false, function() { window.location.href="/after-sales?product="+p.id; }, "bg-orange-500 hover:bg-orange-600 text-white border-0");
        } else if (p.status === "DRAFT") {
          renderBtn(text, true, null, "bg-gray-300 text-gray-500 cursor-not-allowed");
        } else if (p.stock <= 0) {
          renderBtn("暂时缺货", true, null, "bg-gray-300 text-gray-500 cursor-not-allowed");
        } else if (p.paymentMode === "link") {
          if (p.buyLink) {
            renderBtn(text, false, function() { window.open(p.buyLink, "_blank"); });
          } else {
            renderBtn("暂未开放购买", true, null, "bg-gray-300 text-gray-500 cursor-not-allowed");
          }
        } else {
          renderBtn(text, false, function() { window.__ecomBuy(pid); });
        }
      }).catch(function(err) {
        btnDiv.innerHTML = '<span class="text-red-500 text-xs">加载失败</span>';
        console.error("[ecommerce] buy-button hydrate:", err);
      });
    });
  }

  // ═══ 4. product-filter 水合 ═══
  function hydrateProductFilters() {
    var filters = document.querySelectorAll("[data-cms-plugin='product-filter']");
    filters.forEach(function(filterDiv) {
      if (filterDiv.dataset.hydrated) return;
      filterDiv.dataset.hydrated = "1";
      var category = filterDiv.getAttribute("data-category")||"";
      var targetSelector = filterDiv.getAttribute("data-target")||"";
      var layout = filterDiv.getAttribute("data-layout")||"horizontal";
      filterDiv.className = (layout==="vertical"?"flex flex-col gap-3":"flex gap-4 flex-wrap") + " mb-4 cms-product-filter";

      // 获取 category id
      var catIdPromise;
      if (!category) {
        catIdPromise = Promise.resolve("");
      } else {
        catIdPromise = fetch(API+"/products/categories").then(function(r){return r.json();}).then(function(cats) {
          var found = cats.find(function(c){return c.slug===category;});
          return found ? found.id : "";
        }).catch(function(){ return ""; });
      }

      catIdPromise.then(function(catId) {
        fetch(API+"/attributes/filter-options"+(catId?"?categoryId="+catId:"")).then(function(r){return r.json();}).then(function(options) {
          if (!options.length) { filterDiv.innerHTML = '<span class="text-xs text-gray-400">暂无筛选选项</span>'; return; }
          filterDiv.innerHTML = "";
          options.forEach(function(opt) {
            var label = document.createElement("label");
            label.className = "text-xs text-gray-500 flex items-center gap-1";
            label.innerHTML = esc(opt.name)+": ";

            var select = document.createElement("select");
            select.className = "border rounded px-2 py-1 text-sm";
            select.setAttribute("data-attr-slug", opt.slug);
            select.innerHTML = '<option value="">全部</option>' +
              opt.values.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join("");

            select.addEventListener("change", function() {
              var val = select.value;
              // 联动 target grid
              var target = targetSelector ? document.querySelector(targetSelector) : null;
              if (!target && filterDiv.closest("[data-cms-plugin='product-grid']")) {
                target = filterDiv.closest("[data-cms-plugin='product-grid']");
              }
              if (target) {
                var gridFilterDiv = el(target.id+"-filter");
                if (gridFilterDiv) {
                  var gridSels = gridFilterDiv.querySelectorAll("select");
                  gridSels.forEach(function(s) { if (s.querySelector("option") && s.getAttribute("data-attr-slug")===opt.slug) s.selectedIndex = select.selectedIndex; });
                }
                // 重新加载 grid
                var gridContainer = el(target.id+"-grid");
                if (gridContainer) {
                  target.dispatchEvent(new CustomEvent("ecom-filter-change", {detail:{slug:opt.slug,value:val}}));
                }
              }
            });

            select.addEventListener("change", function() { /* already bound */ });
            label.appendChild(select);
            filterDiv.appendChild(label);
          });
        }).catch(function(){});
      }).catch(function(){});
    });
  }

  // ═══ 5. after-sales-form 水合 ═══
  function hydrateAfterSalesForms() {
    var forms = document.querySelectorAll("[data-cms-plugin='after-sales-form']");
    forms.forEach(function(div) {
      if (div.dataset.hydrated) return;
      div.dataset.hydrated = "1";
      var productId = div.getAttribute("data-product-id")||"";
      var divId = div.id;

      // 加载商品信息
      if (productId) {
        fetch(API+"/products/"+productId).then(function(r){return r.json();}).then(function(p) {
          if (p.price !== undefined) {
            var feeDiv = el(divId+"-fee");
            if (feeDiv) { feeDiv.dataset.originalPrice = p.price; feeDiv.dataset.productId = productId; }
          }
        }).catch(function(){});
      }

      // 类型变化时自动计算费用
      var typeSelect = div.querySelector("select[name='type']");
      if (typeSelect) {
        typeSelect.addEventListener("change", function() {
          calcFee(divId);
        });
        // 初始计算一次
        calcFee(divId);
      }

      // 提交
      var formEl = el(divId+"-form");
      if (formEl) {
        formEl.addEventListener("submit", function(e) {
          e.preventDefault();
          var data = Object.fromEntries(new FormData(formEl));
          data.productId = productId;
          fetch(API+"/after-sales", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
            .then(function(r){return r.json();}).then(function(result) {
              if (result.error) { alert(result.error); return; }
              // 自动跳转到支付组件
              var payDivs = document.querySelectorAll("[data-cms-plugin='after-sales-payment']");
              payDivs.forEach(function(pd) { pd.setAttribute("data-order-id", result.id); pd.dataset.hydrated = ""; });
              // 重新水合支付组件
              hydrateAfterSalesPayments();
              // 滚动到支付区域
              var firstPay = document.querySelector("[data-cms-plugin='after-sales-payment']");
              if (firstPay) firstPay.scrollIntoView({behavior:"smooth"});
            }).catch(function(err) { alert("提交失败"); console.error(err); });
        });
      }
    });
  }

  function calcFee(divId) {
    var feeDiv = el(divId+"-fee");
    if (!feeDiv) return;
    var type = el(divId+"-form") ? el(divId+"-form").querySelector("select[name='type']").value : "REPAIR";
    var originalPrice = parseFloat(feeDiv.dataset.originalPrice) || 0;
    var productId = feeDiv.dataset.productId || "";

    fetch(API+"/after-sales/calculate?type="+type+"&originalPrice="+originalPrice+"&productId="+productId)
      .then(function(r){return r.json();}).then(function(result) {
        feeDiv.classList.remove("hidden");
        var feeAmt = el(divId+"-fee-amount");
        var base = el(divId+"-base-fee");
        var rate = el(divId+"-rate");
        if (feeAmt) feeAmt.textContent = "¥"+fmtPrice(result.fee);
        if (base) base.textContent = "¥"+fmtPrice(result.baseFee);
        if (rate) rate.textContent = ((result.rate||0)*100).toFixed(1)+"%";
      }).catch(function(){});
  }

  // ═══ 6. after-sales-payment 水合 ═══
  function hydrateAfterSalesPayments() {
    var payDivs = document.querySelectorAll("[data-cms-plugin='after-sales-payment']");
    payDivs.forEach(function(div) {
      if (div.dataset.hydrated) return;
      div.dataset.hydrated = "1";
      var orderId = div.getAttribute("data-order-id");
      if (!orderId) { div.innerHTML = '<div class="text-red-500 text-sm p-4">缺少 data-order-id</div>'; return; }

      var divId = div.id;
      fetch(API+"/after-sales/"+orderId).then(function(r){return r.json();}).then(function(order) {
        if (order.error) { div.innerHTML = '<div class="text-gray-400 text-sm p-4">工单不存在</div>'; return; }
        if (order.status !== "PENDING" || order.calculatedFee<=0) {
          var infoDiv = el(divId+"-info");
          if (infoDiv) infoDiv.textContent = "费用："+fmtPrice(order.calculatedFee||0)+"  |  状态："+statusLabel(order.status);
          return;
        }

        // 创建支付记录
        fetch(API+"/after-sales/pay", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ afterSalesId: orderId, payType: "NATIVE" })
        }).then(function(r){return r.json();}).then(function(payResult) {
          var infoDiv = el(divId+"-info");
          var qrcodeDiv = el(divId+"-qrcode");
          var qrImg = el(divId+"-qr-img");
          var amtSpan = el(divId+"-amount");
          var expireSpan = el(divId+"-expire");

          if (infoDiv) infoDiv.classList.add("hidden");
          if (qrcodeDiv) qrcodeDiv.classList.remove("hidden");
          if (amtSpan) amtSpan.textContent = "¥"+fmtPrice(payResult.amount);
          if (qrImg && payResult.qrCodeUrl) {
            // 用 qrcode URL 自动生成二维码（如需可用 qrcode.js 库）
            qrImg.innerHTML = '<div class="text-xs text-center">扫码支付 ¥'+fmtPrice(payResult.amount)+'<br/><span class="text-gray-400">(stub)</span></div>';
          }

          // 轮询支付状态
          var pollTimer = setInterval(function() {
            fetch(API+"/after-sales/"+orderId).then(function(r){return r.json();}).then(function(o) {
              if (o.status === "PAID" || o.paidFee > 0) {
                clearInterval(pollTimer);
                if (qrcodeDiv) qrcodeDiv.innerHTML = '<div class="text-green-500 font-bold">✓ 支付成功</div>';
                // 自动切换到状态组件
                var statusDivs = document.querySelectorAll("[data-cms-plugin='after-sales-status']");
                statusDivs.forEach(function(sd) { sd.setAttribute("data-order-id", orderId); sd.dataset.hydrated = ""; });
                hydrateAfterSalesStatuses();
              }
            });
          }, 3000);

          // 过期倒计时
          if (payResult.expireAt) {
            var expTime = new Date(payResult.expireAt).getTime();
            var countTimer = setInterval(function() {
              var remain = Math.max(0, Math.ceil((expTime - Date.now())/1000));
              var min = Math.floor(remain/60);
              var sec = remain%60;
              if (expireSpan) expireSpan.textContent = min+"分"+sec+"秒";
              if (remain <= 0) { clearInterval(countTimer); clearInterval(pollTimer); }
            }, 1000);
          }
        });
      }).catch(function(err) {
        div.innerHTML = '<div class="text-red-500 text-sm p-4">加载失败</div>';
        console.error("[ecommerce] after-sales-payment hydrate:", err);
      });
    });
  }

  // ═══ 7. after-sales-status 水合 ═══
  function hydrateAfterSalesStatuses() {
    var statusDivs = document.querySelectorAll("[data-cms-plugin='after-sales-status']");
    statusDivs.forEach(function(div) {
      if (div.dataset.hydrated) return;
      div.dataset.hydrated = "1";
      var orderId = div.getAttribute("data-order-id");
      if (!orderId) { div.innerHTML = '<div class="text-red-500 text-sm p-4">缺少 data-order-id</div>'; return; }

      var divId = div.id;
      fetch(API+"/after-sales/"+orderId).then(function(r){return r.json();}).then(function(order) {
        if (order.error) { div.innerHTML = '<div class="text-gray-400 text-sm p-4">工单不存在</div>'; return; }

        // 更新状态时间线
        var steps = [
          {key:"submitted", label:"已提交", active:true},
          {key:"paid", label:"已支付", active:order.status!=="PENDING"},
          {key:"pickup", label:"待取件", active:order.pickupTime!=null||order.status==="IN_PROGRESS"||order.status==="PAID"},
          {key:"processing", label:"处理中", active:order.status==="IN_PROGRESS"},
          {key:"completed", label:"已完成", active:order.status==="COMPLETED"},
        ];

        var timelineDiv = el(divId+"-timeline");
        if (timelineDiv) {
          timelineDiv.innerHTML = steps.map(function(s,i) {
            var isActive = s.active;
            var color = isActive ? (s.key==="completed" ? "bg-green-500" : "bg-blue-500") : "bg-gray-300";
            var textColor = isActive ? "text-gray-700 font-medium" : "text-gray-400";
            return '<div class="text-sm flex items-center gap-2 '+textColor+'"><span class="w-3 h-3 rounded-full '+color+' inline-block"></span><span>'+s.label+'</span></div>' +
              (i < steps.length-1 ? '<div class="h-6 w-0.5 '+(steps[i+1].active?'bg-blue-200':'bg-gray-200')+' ml-1.5"></div>' : "");
          }).join("");
        }

        // 详情信息
        var detailDiv = el(divId+"-detail");
        if (detailDiv) {
          detailDiv.classList.remove("hidden");
          var rType = el(divId+"-r-type");
          var rStatus = el(divId+"-r-status");
          var rFee = el(divId+"-r-fee");
          var rPaid = el(divId+"-r-paid");
          var rTrack = el(divId+"-r-tracking");
          var typeMap = {REPAIR:"维修",RETURN:"退货",EXCHANGE:"换货",REFUND:"退款"};
          if (rType) rType.textContent = typeMap[order.type]||order.type;
          if (rStatus) rStatus.textContent = statusLabel(order.status);
          if (rFee) rFee.textContent = "¥"+fmtPrice(order.calculatedFee||0);
          if (rPaid) rPaid.textContent = order.paidFee>0 ? "¥"+fmtPrice(order.paidFee) : "未支付";
          if (rTrack) rTrack.textContent = order.trackingNo || "-";
        }

        // 取件表单（已支付且未有 trackingNo 时显示）
        var pickupDiv = el(divId+"-pickup");
        if (pickupDiv) {
          if ((order.status==="PAID"||order.status==="IN_PROGRESS") && !order.trackingNo && !order.pickupTime) {
            pickupDiv.classList.remove("hidden");
          }
        }
      }).catch(function(err) {
        div.innerHTML = '<div class="text-red-500 text-sm p-4">加载失败</div>';
        console.error("[ecommerce] after-sales-status hydrate:", err);
      });
    });
  }

  // ═══ 全局工具 ═══
  window.__ecomBuy = function(productId) {
    // 跳转到购买页面（简化流程，后续可改为弹窗）
    window.location.href = "/buy?productId=" + productId;
  };

  window.__asSchedulePickup = function(divId, orderId) {
    var addr = el(divId+"-pu-address").value;
    var time = el(divId+"-pu-time").value;
    if (!addr || !time) { alert("请填写取件地址和预约时间"); return; }
    fetch(API+"/after-sales/"+orderId, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({pickupAddress:addr, pickupTime:time, status:"PICKUP_SCHEDULED"})
    }).then(function(r){return r.json();}).then(function() {
      alert("取件已预约");
      // 重新水合状态
      document.querySelectorAll("[data-cms-plugin='after-sales-status']").forEach(function(sd) {
        sd.dataset.hydrated = "";
      });
      hydrateAfterSalesStatuses();
    });
  };

  // ═══ 全部初始化 ═══
  hydrateProductCards();
  hydrateProductGrids();
  hydrateBuyButtons();
  hydrateProductFilters();
  hydrateAfterSalesForms();
  hydrateAfterSalesPayments();
  hydrateAfterSalesStatuses();
})();</script>`;
}
