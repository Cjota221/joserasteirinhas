'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════ */
  const STORAGE_KEY       = 'salesStockData';
  const LOW_STOCK         = 5;
  const DEFAULT_PRODUCTS  = [
    { id: 'p25', name: 'Rasteirinha', price: 25, active: true },
    { id: 'p35', name: 'Rasteirinha', price: 35, active: true },
  ];

  /* ══════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════ */
  let data = {
    profile:      { name: 'José', photo: null },
    products:     [],
    stock:        {},
    salesHistory: [],
    stockHistory: [],
  };

  let saleProductId     = null;  // product chosen in sale modal
  let editStockId       = null;  // product being edited in stock modal
  let editingProductId  = null;  // product being edited in product modal
  let confirmCallback   = null;  // pending confirmation action

  /* ══════════════════════════════════════════════
     DOM SHORTCUTS
  ══════════════════════════════════════════════ */
  const $  = id  => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const ui = {
    /* profile */
    photoUpload:     $('photo-upload'),
    profileImage:    $('profile-image'),
    profileIcon:     $('profile-icon-svg'),
    userNameWrapper: $('user-name-wrapper'),
    userName:        $('user-name'),
    currentDate:     $('current-date'),

    /* navigation */
    navBtns:  $$('.nav-btn'),
    views:    $$('.view'),

    /* sell view */
    newSaleBtn:         $('new-sale-btn'),
    dailyRevenue:       $('daily-revenue-summary'),
    dailyPairs:         $('daily-pairs-summary'),
    productPreviewGrid: $('product-preview-grid'),

    /* stock view */
    totalStockValue:    $('total-stock-value'),
    totalStockQty:      $('total-stock-quantity'),
    stockCardsGrid:     $('stock-cards-grid'),

    /* reports view */
    reportsTitle:       $('reports-title'),
    totalRevenue:       $('total-revenue'),
    totalPairsSold:     $('total-pairs-sold'),
    salesChart:         $('sales-chart'),
    productStatsList:   $('product-stats-list'),
    startDate:          $('start-date-filter'),
    endDate:            $('end-date-filter'),
    monthFilter:        $('month-filter'),
    historyList:        $('sales-history-list'),
    noSalesMsg:         $('no-sales-message'),
    exportCsvBtn:       $('export-csv-btn'),
    exportBackupBtn:    $('export-backup-btn'),
    restoreBackupBtn:   $('restore-backup-btn'),
    restoreFileInput:   $('restore-file-input'),

    /* products view */
    addProductBtn: $('add-product-btn'),
    productsList:  $('products-list'),

    /* sale modal */
    saleModal:           $('sale-modal'),
    saleStep1:           $('sale-step-1'),
    saleStep2:           $('sale-step-2'),
    productSelectGrid:   $('product-selection-grid'),
    saleProductTitle:    $('sale-product-title'),
    saleQtyForm:         $('sale-quantity-form'),
    saleQtyInput:        $('modal-sale-quantity'),
    stockAvailHint:      $('stock-available-hint'),
    backToProductsBtn:   $('back-to-products-btn'),

    /* edit stock modal */
    editStockModal:      $('edit-stock-modal'),
    editStockTitle:      $('edit-stock-product-title'),
    editStockForm:       $('edit-stock-form'),
    editStockQty:        $('edit-stock-quantity'),

    /* product modal */
    productModal:        $('product-modal'),
    productModalTitle:   $('product-modal-title'),
    productForm:         $('product-form'),
    productIdInput:      $('product-id-input'),
    productNameInput:    $('product-name-input'),
    productPriceInput:   $('product-price-input'),
    productFormSubmit:   $('product-form-submit'),

    /* confirm modal */
    confirmModal:   $('confirm-modal'),
    confirmTitle:   $('confirm-heading'),
    confirmMsg:     $('confirm-message'),
    confirmOkBtn:   $('confirm-ok-btn'),
    confirmCancelBtn: $('confirm-cancel-btn'),

    /* toast */
    toast: $('toast'),
  };

  /* ══════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════ */
  function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function fmt(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function dateKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function todayKey() { return dateKey(new Date().toISOString()); }

  function getProduct(id) { return data.products.find(p => p.id === id); }

  function activeProducts() { return data.products.filter(p => p.active); }

  function stockOf(id) { return data.stock[id] || 0; }

  /* ══════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════ */
  let toastTimer = null;

  function toast(message, type = 'success') {
    const icon = type === 'success'
      ? `<span style="color:#e7ff6e;margin-right:6px;">✓</span>`
      : `<span style="color:#ff6b6b;margin-right:6px;">✕</span>`;
    ui.toast.innerHTML = icon + message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3000);
  }

  /* ══════════════════════════════════════════════
     MODALS
  ══════════════════════════════════════════════ */
  function openModal(id)  { $(id).classList.add('show'); }
  function closeModal(id) { $(id).classList.remove('show'); }

  // Close by clicking overlay background
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  // Close buttons via data-close attribute
  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  /* ══════════════════════════════════════════════
     CONFIRM DIALOG
  ══════════════════════════════════════════════ */
  function confirm(title, message, onOk) {
    ui.confirmTitle.textContent = title;
    ui.confirmMsg.textContent   = message;
    confirmCallback = onOk;
    openModal('confirm-modal');
  }

  ui.confirmOkBtn.addEventListener('click', () => {
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    closeModal('confirm-modal');
  });

  ui.confirmCancelBtn.addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirm-modal');
  });

  /* ══════════════════════════════════════════════
     DATA — LOAD & MIGRATE
  ══════════════════════════════════════════════ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = migrate(JSON.parse(raw));
      } else {
        /* First launch — seed with default products */
        data.products = DEFAULT_PRODUCTS.map(p => ({
          ...p, created_at: new Date().toISOString(),
        }));
        DEFAULT_PRODUCTS.forEach(p => { data.stock[p.id] = 0; });
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    }
  }

  function migrate(raw) {
    const out = {
      profile:      raw.profile || { name: 'José', photo: null },
      products:     [],
      stock:        {},
      salesHistory: [],
      stockHistory: [],
    };

    /* ── products ── */
    if (Array.isArray(raw.products) && raw.products.length) {
      out.products = raw.products.map(p => ({
        id:         p.id,
        name:       p.name,
        price:      Number(p.price),
        active:     p.active !== undefined ? Boolean(p.active) : true,
        created_at: p.created_at || new Date().toISOString(),
      }));
    } else {
      /* Old format: no products array → seed defaults */
      out.products = DEFAULT_PRODUCTS.map(p => ({
        ...p, created_at: new Date().toISOString(),
      }));
    }

    /* Ensure built-in defaults always exist */
    DEFAULT_PRODUCTS.forEach(dp => {
      if (!out.products.find(p => p.id === dp.id)) {
        out.products.push({ ...dp, created_at: new Date().toISOString() });
      }
    });

    /* ── stock ── */
    out.products.forEach(p => {
      out.stock[p.id] = (raw.stock && raw.stock[p.id] !== undefined)
        ? Number(raw.stock[p.id]) : 0;
    });

    /* ── salesHistory ── */
    if (Array.isArray(raw.salesHistory)) {
      out.salesHistory = raw.salesHistory.map(s => ({
        id:        s.id || genId(),
        productId: s.productId,
        quantity:  Number(s.quantity),
        price:     Number(s.price),
        date:      s.date,
      }));
    }

    /* ── stockHistory ── */
    if (Array.isArray(raw.stockHistory)) {
      out.stockHistory = raw.stockHistory.map(h => ({
        id:        h.id || genId(),
        productId: h.productId,
        quantity:  Number(h.quantity),
        date:      h.date,
      }));
    }

    return out;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ══════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════ */
  function setupNav() {
    ui.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.view;
        ui.views.forEach(v => v.classList.toggle('hidden', v.id !== target));
        ui.navBtns.forEach(b => b.classList.toggle('active', b === btn));
        if (target === 'reports-view') renderChart();
      });
    });
  }

  /* ══════════════════════════════════════════════
     PROFILE
  ══════════════════════════════════════════════ */
  function updateProfile() {
    ui.userName.textContent = data.profile.name;

    if (data.profile.photo) {
      ui.profileImage.src = data.profile.photo;
      ui.profileImage.classList.remove('hidden');
      ui.profileIcon.classList.add('hidden');
    } else {
      ui.profileImage.classList.add('hidden');
      ui.profileIcon.classList.remove('hidden');
    }

    const now  = new Date();
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const str  = now.toLocaleDateString('pt-BR', opts);
    ui.currentDate.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }

  function setupProfile() {
    ui.userName.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.className = 'user-name-edit-input';
      inp.type      = 'text';
      inp.value     = data.profile.name;

      const commit = () => {
        const val = inp.value.trim();
        if (val) { data.profile.name = val; save(); }
        updateProfile();
        ui.userNameWrapper.replaceChild(ui.userName, inp);
      };

      inp.addEventListener('blur',    commit);
      inp.addEventListener('keydown', e => e.key === 'Enter' && inp.blur());
      ui.userNameWrapper.replaceChild(ui.userName, inp);
      inp.focus();
    });

    ui.photoUpload.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        data.profile.photo = reader.result;
        save(); updateProfile();
        toast('Foto atualizada!');
      };
      reader.readAsDataURL(file);
    });
  }

  /* ══════════════════════════════════════════════
     SELL VIEW
  ══════════════════════════════════════════════ */
  function updateDailySummary() {
    const tk   = todayKey();
    const stat = data.salesHistory.reduce((acc, s) => {
      if (dateKey(s.date) === tk) {
        acc.rev   += s.quantity * s.price;
        acc.pairs += s.quantity;
      }
      return acc;
    }, { rev: 0, pairs: 0 });

    ui.dailyRevenue.textContent = fmt(stat.rev);
    ui.dailyPairs.textContent   = stat.pairs;
  }

  function renderProductPreview() {
    const active = activeProducts();
    ui.productPreviewGrid.innerHTML = '';

    if (!active.length) {
      ui.productPreviewGrid.innerHTML = '<p class="no-data-text">Nenhum produto ativo.</p>';
      return;
    }

    active.forEach(p => {
      const qty     = stockOf(p.id);
      const low     = qty > 0 && qty <= LOW_STOCK;
      const card    = document.createElement('div');
      card.className = 'product-preview-card';
      card.innerHTML = `
        <p class="product-preview-name">${p.name}</p>
        <p class="product-preview-price">${fmt(p.price)}</p>
        <p class="product-preview-stock">${qty} par${qty !== 1 ? 'es' : ''} em estoque</p>
        ${low ? '<span class="badge-low-stock">⚠ Estoque Baixo</span>' : ''}
      `;
      ui.productPreviewGrid.appendChild(card);
    });
  }

  /* ── Sale Modal ── */
  function openSaleModal() {
    const active = activeProducts();
    ui.productSelectGrid.innerHTML = '';

    if (!active.length) {
      ui.productSelectGrid.innerHTML =
        '<p class="no-data-text" style="grid-column:1/-1">Cadastre produtos na aba Produtos.</p>';
    } else {
      active.forEach(p => {
        const qty = stockOf(p.id);
        const btn = document.createElement('button');
        btn.className         = 'btn-product-select';
        btn.dataset.productId = p.id;
        btn.innerHTML = `
          <span class="btn-product-select-name">${p.name}</span>
          <span class="btn-product-select-price">${fmt(p.price)}</span>
          <span class="btn-product-select-stock">📦 ${qty} em estoque</span>
        `;
        btn.addEventListener('click', () => pickProduct(p.id));
        ui.productSelectGrid.appendChild(btn);
      });
    }

    ui.saleStep1.classList.remove('hidden');
    ui.saleStep2.classList.add('hidden');
    ui.saleQtyForm.reset();
    openModal('sale-modal');
  }

  function pickProduct(id) {
    saleProductId = id;
    const p   = getProduct(id);
    const qty = stockOf(id);
    ui.saleProductTitle.textContent = `${p.name} — ${fmt(p.price)}`;
    ui.stockAvailHint.textContent   = `${qty} par${qty !== 1 ? 'es' : ''} disponível${qty !== 1 ? 'is' : ''}`;
    ui.saleStep1.classList.add('hidden');
    ui.saleStep2.classList.remove('hidden');
    ui.saleQtyInput.value = '';
    ui.saleQtyInput.focus();
  }

  ui.backToProductsBtn.addEventListener('click', () => {
    ui.saleStep2.classList.add('hidden');
    ui.saleStep1.classList.remove('hidden');
    ui.saleQtyForm.reset();
    saleProductId = null;
  });

  ui.saleQtyForm.addEventListener('submit', e => {
    e.preventDefault();
    const qty   = parseInt(ui.saleQtyInput.value, 10);
    const stock = stockOf(saleProductId);

    if (!qty || qty <= 0)  { toast('Insira uma quantidade válida.', 'error'); return; }
    if (qty > stock) { toast(`Estoque insuficiente. Apenas ${stock} disponível.`, 'error'); return; }

    const p = getProduct(saleProductId);
    data.stock[saleProductId] -= qty;
    data.salesHistory.push({
      id: genId(), productId: saleProductId,
      quantity: qty, price: p.price,
      date: new Date().toISOString(),
    });

    save(); refresh(); closeModal('sale-modal');
    toast('Venda registrada!');
  });

  ui.newSaleBtn.addEventListener('click', openSaleModal);

  /* ══════════════════════════════════════════════
     STOCK VIEW
  ══════════════════════════════════════════════ */
  function updateStockSummary() {
    let val = 0, qty = 0;
    data.products.forEach(p => {
      const q = stockOf(p.id);
      val += q * p.price;
      qty += q;
    });
    ui.totalStockValue.textContent = fmt(val);
    ui.totalStockQty.textContent   = qty;
  }

  function renderStockCards() {
    ui.stockCardsGrid.innerHTML = '';

    if (!data.products.length) {
      ui.stockCardsGrid.innerHTML = '<p class="no-data-text">Nenhum produto cadastrado.</p>';
      return;
    }

    data.products.forEach(p => {
      const qty  = stockOf(p.id);
      const low  = p.active && qty > 0 && qty <= LOW_STOCK;
      const last = [...data.stockHistory].filter(h => h.productId === p.id).pop();

      const lastHtml = last
        ? `<div class="last-addition">
             <span>Última adição: <strong>+${last.quantity}</strong> em ${fmtDate(last.date)}</span>
             <button class="btn-undo" data-undo="${p.id}">Desfazer</button>
           </div>`
        : '';

      const card = document.createElement('div');
      card.className = 'stock-card';
      card.innerHTML = `
        <div class="stock-card-header">
          <div>
            <p class="stock-card-name">${p.name}</p>
            <p class="stock-card-price">${fmt(p.price)}</p>
            ${!p.active ? '<span class="badge-inactive">Inativo</span>' : ''}
          </div>
          ${low ? '<span class="badge-low-stock">⚠ Estoque Baixo</span>' : ''}
        </div>
        <div class="stock-qty-row">
          <span class="stock-qty-value" data-edit-stock="${p.id}" title="Clique para editar">${qty}</span>
          <span class="stock-edit-hint" data-edit-stock="${p.id}">✏ editar</span>
        </div>
        <div class="stock-add-row">
          <input type="number" class="input" id="stock-in-${p.id}" placeholder="Qtd." min="1">
          <button class="btn btn-primary btn-compact" data-add-stock="${p.id}">+ Adicionar</button>
        </div>
        ${lastHtml}
      `;
      ui.stockCardsGrid.appendChild(card);
    });

    ui.stockCardsGrid.querySelectorAll('[data-edit-stock]').forEach(el => {
      el.addEventListener('click', () => openEditStockModal(el.dataset.editStock));
    });

    ui.stockCardsGrid.querySelectorAll('[data-add-stock]').forEach(btn => {
      btn.addEventListener('click', () => addStock(btn.dataset.addStock));
    });

    ui.stockCardsGrid.querySelectorAll('[data-undo]').forEach(btn => {
      btn.addEventListener('click', () => undoStock(btn.dataset.undo));
    });
  }

  function addStock(productId) {
    const input = $(`stock-in-${productId}`);
    const qty   = parseInt(input.value, 10);
    if (!qty || qty <= 0) { toast('Insira uma quantidade válida.', 'error'); return; }

    data.stock[productId] = (data.stock[productId] || 0) + qty;
    data.stockHistory.push({
      id: genId(), productId, quantity: qty,
      date: new Date().toISOString(),
    });
    save(); refresh();
    toast(`${qty} par${qty > 1 ? 'es' : ''} adicionado${qty > 1 ? 's' : ''}!`);
  }

  function undoStock(productId) {
    const entries = data.stockHistory.filter(h => h.productId === productId);
    if (!entries.length) { toast('Nenhuma adição para desfazer.', 'error'); return; }

    const last = entries[entries.length - 1];
    if (stockOf(productId) < last.quantity) {
      toast('Não é possível desfazer — itens já vendidos.', 'error');
      return;
    }

    confirm('Desfazer Adição', `Remover +${last.quantity} do estoque?`, () => {
      data.stock[productId] -= last.quantity;
      let idx = -1;
      for (let i = data.stockHistory.length - 1; i >= 0; i--) {
        if (data.stockHistory[i].id === last.id) { idx = i; break; }
      }
      if (idx > -1) data.stockHistory.splice(idx, 1);
      save(); refresh();
      toast('Adição desfeita!');
    });
  }

  /* Edit Stock Modal */
  function openEditStockModal(productId) {
    editStockId = productId;
    const p = getProduct(productId);
    ui.editStockTitle.textContent = `Editar: ${p.name}`;
    ui.editStockQty.value = stockOf(productId);
    openModal('edit-stock-modal');
    ui.editStockQty.focus();
  }

  ui.editStockForm.addEventListener('submit', e => {
    e.preventDefault();
    const qty = parseInt(ui.editStockQty.value, 10);
    if (isNaN(qty) || qty < 0) { toast('Quantidade inválida.', 'error'); return; }

    data.stock[editStockId] = qty;
    save(); refresh();
    closeModal('edit-stock-modal');
    toast('Estoque atualizado!');
  });

  /* ══════════════════════════════════════════════
     REPORTS VIEW
  ══════════════════════════════════════════════ */
  function getFilteredSales() {
    const startVal = ui.startDate.value;
    const endVal   = ui.endDate.value;
    const monthVal = ui.monthFilter.value;

    let sales = data.salesHistory.slice();
    let title = 'Relatório Geral';

    if (startVal && endVal) {
      const s = new Date(startVal + 'T00:00:00');
      const e = new Date(endVal   + 'T23:59:59');
      sales = sales.filter(x => {
        const d = new Date(x.date);
        return d >= s && d <= e;
      });
      title = `${fmtDate(startVal + 'T12:00:00')} — ${fmtDate(endVal + 'T12:00:00')}`;
    } else if (monthVal && monthVal !== 'all') {
      sales = sales.filter(x => {
        const d = new Date(x.date);
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return mk === monthVal;
      });
      const [y, m] = monthVal.split('-');
      const mname  = new Date(y, m - 1).toLocaleString('pt-BR', { month: 'long' });
      title = `${mname.charAt(0).toUpperCase() + mname.slice(1)} de ${y}`;
    }

    return { sales, title };
  }

  function updateReports() {
    const { sales, title } = getFilteredSales();
    ui.reportsTitle.textContent = title;

    const stats = sales.reduce((acc, s) => {
      acc.revenue += s.quantity * s.price;
      acc.pairs   += s.quantity;
      if (!acc.byProduct[s.productId]) acc.byProduct[s.productId] = { qty: 0 };
      acc.byProduct[s.productId].qty += s.quantity;
      return acc;
    }, { revenue: 0, pairs: 0, byProduct: {} });

    ui.totalRevenue.textContent   = fmt(stats.revenue);
    ui.totalPairsSold.textContent = stats.pairs;

    /* Product breakdown */
    ui.productStatsList.innerHTML = '';
    data.products.forEach(p => {
      const pst  = stats.byProduct[p.id] || { qty: 0 };
      const row  = document.createElement('div');
      row.className = 'product-stat-row';
      row.innerHTML = `
        <span class="product-stat-name">${p.name} (${fmt(p.price)})</span>
        <span class="product-stat-value">${pst.qty} pares</span>
      `;
      ui.productStatsList.appendChild(row);
    });

    renderHistory(sales);
  }

  function populateMonthFilter() {
    const months = new Set();
    data.salesHistory.forEach(s => {
      const d  = new Date(s.date);
      months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    });

    const cur = ui.monthFilter.value;
    ui.monthFilter.innerHTML = '<option value="all">Todos os meses</option>';
    [...months].sort().reverse().forEach(m => {
      const [y, mo] = m.split('-');
      const name    = new Date(y, mo - 1).toLocaleString('pt-BR', { month: 'long' });
      const opt     = document.createElement('option');
      opt.value     = m;
      opt.textContent = `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`;
      ui.monthFilter.appendChild(opt);
    });
    ui.monthFilter.value = cur || 'all';
  }

  function renderHistory(sales) {
    ui.historyList.innerHTML = '';
    const sorted = sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!sorted.length) {
      ui.noSalesMsg.classList.remove('hidden');
      return;
    }
    ui.noSalesMsg.classList.add('hidden');

    sorted.forEach(s => {
      const p   = getProduct(s.productId);
      const nm  = p ? p.name : 'Produto';
      const pr  = p ? fmt(p.price) : '';
      const li  = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div>
          <span class="history-item-name">${nm} — ${pr}</span>
          <span class="history-item-meta">${s.quantity} par${s.quantity > 1 ? 'es' : ''} • ${fmtDateTime(s.date)}</span>
        </div>
        <div class="history-item-right">
          <span class="history-item-value">${fmt(s.quantity * s.price)}</span>
          <button class="btn-delete" data-del="${s.id}" title="Excluir venda">
            <svg><use href="#icon-trash"></use></svg>
          </button>
        </div>
      `;
      ui.historyList.appendChild(li);
    });

    ui.historyList.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => deleteSale(btn.dataset.del));
    });
  }

  function deleteSale(id) {
    confirm('Apagar Venda', 'Tem certeza? O estoque será devolvido.', () => {
      const idx = data.salesHistory.findIndex(s => s.id === id);
      if (idx === -1) { toast('Venda não encontrada.', 'error'); return; }
      const s = data.salesHistory[idx];
      data.stock[s.productId] = (data.stock[s.productId] || 0) + s.quantity;
      data.salesHistory.splice(idx, 1);
      save(); refresh();
      toast('Venda removida e estoque devolvido!');
    });
  }

  /* Sales Chart — last 7 days */
  function renderChart() {
    ui.salesChart.innerHTML = '';
    const days = [];
    const now  = new Date();

    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now);
      d.setDate(d.getDate() - i);
      const key   = dateKey(d.toISOString());
      const label = i === 0
        ? 'Hoje'
        : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      days.push({ key, label, rev: 0 });
    }

    data.salesHistory.forEach(s => {
      const day = days.find(d => d.key === dateKey(s.date));
      if (day) day.rev += s.quantity * s.price;
    });

    const maxRev  = Math.max(...days.map(d => d.rev), 1);
    const barArea = 100; /* px */

    days.forEach(d => {
      const pct  = Math.round((d.rev / maxRev) * barArea);
      const col  = document.createElement('div');
      col.className = 'chart-col';

      const valEl = document.createElement('span');
      valEl.className   = 'chart-bar-val';
      valEl.textContent = d.rev > 0 ? fmt(d.rev).replace('R$ ', '') : '';

      const bar = document.createElement('div');
      bar.className = 'chart-bar' + (d.rev === 0 ? ' chart-bar-empty' : '');
      bar.style.height = `${Math.max(pct, d.rev > 0 ? 6 : 3)}px`;

      const dayEl = document.createElement('span');
      dayEl.className   = 'chart-bar-day';
      dayEl.textContent = d.label;

      col.appendChild(valEl);
      col.appendChild(bar);
      col.appendChild(dayEl);
      ui.salesChart.appendChild(col);
    });
  }

  /* Filters */
  ui.monthFilter.addEventListener('change', () => {
    ui.startDate.value = '';
    ui.endDate.value   = '';
    updateReports();
  });

  const onDateChange = () => {
    ui.monthFilter.value = 'all';
    updateReports();
  };

  ui.startDate.addEventListener('change', onDateChange);
  ui.endDate.addEventListener('change',   onDateChange);

  /* ══════════════════════════════════════════════
     PRODUCTS VIEW
  ══════════════════════════════════════════════ */
  function renderProductsList() {
    ui.productsList.innerHTML = '';

    if (!data.products.length) {
      ui.productsList.innerHTML = '<p class="no-data-text">Nenhum produto cadastrado.</p>';
      return;
    }

    data.products.forEach(p => {
      const qty  = stockOf(p.id);
      const card = document.createElement('div');
      card.className = 'product-card' + (!p.active ? ' product-card-inactive' : '');
      card.innerHTML = `
        <div class="product-card-info">
          <p class="product-card-name">${p.name}</p>
          <p class="product-card-price">${fmt(p.price)}</p>
          <p class="product-card-stock">${qty} em estoque</p>
          ${!p.active ? '<span class="badge-inactive">Inativo</span>' : ''}
        </div>
        <div class="product-card-actions">
          <button class="btn-product-action" data-edit-prod="${p.id}" title="Editar">
            <svg><use href="#icon-edit"></use></svg>
          </button>
          <button class="btn-product-action" data-toggle-prod="${p.id}" title="${p.active ? 'Desativar' : 'Ativar'}">
            <svg><use href="${p.active ? '#icon-eye-off' : '#icon-eye'}"></use></svg>
          </button>
        </div>
      `;
      ui.productsList.appendChild(card);
    });

    ui.productsList.querySelectorAll('[data-edit-prod]').forEach(btn => {
      btn.addEventListener('click', () => openEditProduct(btn.dataset.editProd));
    });

    ui.productsList.querySelectorAll('[data-toggle-prod]').forEach(btn => {
      btn.addEventListener('click', () => toggleProduct(btn.dataset.toggleProd));
    });
  }

  function openAddProduct() {
    editingProductId = null;
    ui.productModalTitle.textContent  = 'Adicionar Produto';
    ui.productFormSubmit.textContent  = 'Adicionar Produto';
    ui.productForm.reset();
    ui.productIdInput.value = '';
    openModal('product-modal');
    ui.productNameInput.focus();
  }

  function openEditProduct(id) {
    editingProductId = id;
    const p = getProduct(id);
    ui.productModalTitle.textContent  = 'Editar Produto';
    ui.productFormSubmit.textContent  = 'Salvar Alterações';
    ui.productIdInput.value           = id;
    ui.productNameInput.value         = p.name;
    ui.productPriceInput.value        = p.price;
    openModal('product-modal');
    ui.productNameInput.focus();
  }

  function toggleProduct(id) {
    const p = getProduct(id);
    confirm(
      p.active ? 'Desativar Produto' : 'Ativar Produto',
      `${p.active ? 'Desativar' : 'Ativar'} "${p.name}"?`,
      () => {
        p.active = !p.active;
        save(); refresh();
        toast(`Produto ${p.active ? 'ativado' : 'desativado'}!`);
      }
    );
  }

  ui.addProductBtn.addEventListener('click', openAddProduct);

  ui.productForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = ui.productNameInput.value.trim();
    const price = parseFloat(ui.productPriceInput.value);

    if (!name)            { toast('Nome é obrigatório.', 'error'); return; }
    if (!price || price <= 0) { toast('Preço inválido.', 'error'); return; }

    if (editingProductId) {
      const p = getProduct(editingProductId);
      p.name  = name;
      p.price = price;
      toast('Produto atualizado!');
    } else {
      const newId = 'p_' + Date.now();
      data.products.push({
        id: newId, name, price, active: true,
        created_at: new Date().toISOString(),
      });
      data.stock[newId] = 0;
      toast('Produto adicionado!');
    }

    save(); refresh();
    closeModal('product-modal');
  });

  /* ══════════════════════════════════════════════
     EXPORT / IMPORT
  ══════════════════════════════════════════════ */
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (!data.salesHistory.length) {
      toast('Nenhuma venda para exportar.', 'error');
      return;
    }

    const cols = ['Data', 'Hora', 'Produto', 'Quantidade', 'Preço Unitário', 'Total'];
    const rows = data.salesHistory
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(s => {
        const d  = new Date(s.date);
        const p  = getProduct(s.productId);
        const nm = p ? p.name : 'Produto';
        return [
          d.toLocaleDateString('pt-BR'),
          d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          nm,
          s.quantity,
          s.price.toFixed(2).replace('.', ','),
          (s.quantity * s.price).toFixed(2).replace('.', ','),
        ].join(';');
      });

    const csv  = [cols.join(';'), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `vendas_jose_${date}.csv`);
    toast('CSV exportado!');
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `backup_jose_${date}.json`);
    toast('Backup exportado!');
  }

  ui.exportCsvBtn.addEventListener('click',    exportCSV);
  ui.exportBackupBtn.addEventListener('click', exportBackup);

  ui.restoreBackupBtn.addEventListener('click', () => ui.restoreFileInput.click());

  ui.restoreFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        confirm(
          'Restaurar Backup',
          'Isso vai substituir TODOS os dados atuais. Tem certeza?',
          () => {
            data = migrate(parsed);
            save(); refresh(); updateProfile();
            toast('Backup restaurado!');
          }
        );
      } catch {
        toast('Arquivo inválido.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  /* ══════════════════════════════════════════════
     REFRESH ALL
  ══════════════════════════════════════════════ */
  function refresh() {
    updateDailySummary();
    renderProductPreview();
    updateStockSummary();
    renderStockCards();
    populateMonthFilter();
    updateReports();
    renderProductsList();
    renderChart();
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  load();
  setupNav();
  setupProfile();
  updateProfile();
  refresh();
});
