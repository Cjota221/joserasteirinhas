'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  /* ══════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════ */
  const PROFILE_KEY      = 'jose_profile';
  const LOW_STOCK        = 5;
  const DEFAULT_PRODUCTS = [
    { id: 'p25', name: 'Rasteirinha', price: 25, active: true },
    { id: 'p35', name: 'Rasteirinha', price: 35, active: true },
  ];

  /* ══════════════════════════════════════════════
     STATE  (in-memory, fonte de verdade da UI)
  ══════════════════════════════════════════════ */
  let data = {
    profile:      { name: 'José', photo: null },
    products:     [],
    stock:        {},
    salesHistory: [],
    stockHistory: [],
  };

  let saleProductId    = null;
  let editStockId      = null;
  let editingProductId = null;
  let confirmCallback  = null;

  /* ══════════════════════════════════════════════
     DOM
  ══════════════════════════════════════════════ */
  const $  = id  => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const ui = {
    photoUpload:      $('photo-upload'),
    profileImage:     $('profile-image'),
    profileIcon:      $('profile-icon-svg'),
    userNameWrapper:  $('user-name-wrapper'),
    userName:         $('user-name'),
    currentDate:      $('current-date'),
    connDot:          $('conn-dot'),
    navBtns:          $$('.nav-btn'),
    views:            $$('.view'),
    newSaleBtn:       $('new-sale-btn'),
    dailyRevenue:     $('daily-revenue-summary'),
    dailyPairs:       $('daily-pairs-summary'),
    productPreview:   $('product-preview-grid'),
    totalStockValue:  $('total-stock-value'),
    totalStockQty:    $('total-stock-quantity'),
    stockCardsGrid:   $('stock-cards-grid'),
    reportsTitle:     $('reports-title'),
    totalRevenue:     $('total-revenue'),
    totalPairsSold:   $('total-pairs-sold'),
    salesChart:       $('sales-chart'),
    productStatsList: $('product-stats-list'),
    startDate:        $('start-date-filter'),
    endDate:          $('end-date-filter'),
    monthFilter:      $('month-filter'),
    historyList:      $('sales-history-list'),
    noSalesMsg:       $('no-sales-message'),
    exportCsvBtn:     $('export-csv-btn'),
    exportBackupBtn:  $('export-backup-btn'),
    restoreBackupBtn: $('restore-backup-btn'),
    restoreFileInput: $('restore-file-input'),
    addProductBtn:    $('add-product-btn'),
    productsList:     $('products-list'),
    saleModal:        $('sale-modal'),
    saleStep1:        $('sale-step-1'),
    saleStep2:        $('sale-step-2'),
    productSelectGrid:$('product-selection-grid'),
    saleProductTitle: $('sale-product-title'),
    saleQtyForm:      $('sale-quantity-form'),
    saleQtyInput:     $('modal-sale-quantity'),
    stockAvailHint:   $('stock-available-hint'),
    backToProductsBtn:$('back-to-products-btn'),
    editStockModal:   $('edit-stock-modal'),
    editStockTitle:   $('edit-stock-product-title'),
    editStockForm:    $('edit-stock-form'),
    editStockQty:     $('edit-stock-quantity'),
    productModal:     $('product-modal'),
    productModalTitle:$('product-modal-title'),
    productForm:      $('product-form'),
    productIdInput:   $('product-id-input'),
    productNameInput: $('product-name-input'),
    productPriceInput:$('product-price-input'),
    productFormSubmit:$('product-form-submit'),
    confirmModal:     $('confirm-modal'),
    confirmTitle:     $('confirm-heading'),
    confirmMsg:       $('confirm-message'),
    confirmOkBtn:     $('confirm-ok-btn'),
    confirmCancelBtn: $('confirm-cancel-btn'),
    toast:            $('toast'),
  };

  /* ══════════════════════════════════════════════
     UTILS
  ══════════════════════════════════════════════ */
  function genId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function fmtDateTime(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
    });
  }

  function dateKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const todayKey   = ()  => dateKey(new Date().toISOString());
  const getProduct = id  => data.products.find(p => p.id === id);
  const active     = ()  => data.products.filter(p => p.active);
  const stockOf    = id  => data.stock[id] || 0;

  /* ══════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════ */
  let toastTimer = null;

  function toast(msg, type = 'success') {
    const icons = {
      success: `<span style="color:#e7ff6e;margin-right:6px">✓</span>`,
      error:   `<span style="color:#ff6b6b;margin-right:6px">✕</span>`,
      warn:    `<span style="color:#e7ff6e;margin-right:6px">⚡</span>`,
    };
    ui.toast.innerHTML = (icons[type] || icons.success) + msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3500);
  }

  /* ══════════════════════════════════════════════
     MODALS
  ══════════════════════════════════════════════ */
  const openModal  = id => $(id).classList.add('show');
  const closeModal = id => $(id).classList.remove('show');

  $$('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
  });

  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  /* ══════════════════════════════════════════════
     CONFIRM DIALOG
  ══════════════════════════════════════════════ */
  function confirm(title, msg, onOk) {
    ui.confirmTitle.textContent = title;
    ui.confirmMsg.textContent   = msg;
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
     CONNECTION STATUS
  ══════════════════════════════════════════════ */
  function setConnStatus(online) {
    if (!ui.connDot) return;
    ui.connDot.classList.toggle('conn-dot-offline', !online);
    ui.connDot.title = online
      ? (DB.queueLength() > 0 ? `Online — ${DB.queueLength()} ação(ões) na fila` : 'Online')
      : 'Sem internet';
  }

  function setupConnectionStatus() {
    setConnStatus(navigator.onLine);

    window.addEventListener('online', async () => {
      setConnStatus(true);
      toast('Conexão restaurada — sincronizando…', 'warn');
      const n = await DB.processQueue();
      if (n > 0) {
        toast(`${n} ação(ões) sincronizada(s)!`);
        await reloadFromSupabase();
      }
      setConnStatus(true);
    });

    window.addEventListener('offline', () => {
      setConnStatus(false);
      toast('Sem internet — dados salvos localmente', 'warn');
    });
  }

  /* ══════════════════════════════════════════════
     PROFILE  (fica no localStorage — é do dispositivo)
  ══════════════════════════════════════════════ */
  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) return JSON.parse(raw);
      // Migrar do formato antigo
      const old = JSON.parse(localStorage.getItem('salesStockData') || '{}');
      return old.profile || { name: 'José', photo: null };
    } catch { return { name: 'José', photo: null }; }
  }

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
  }

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
    const str = new Date().toLocaleDateString('pt-BR', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    });
    ui.currentDate.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }

  function setupProfile() {
    ui.userName.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.className = 'user-name-edit-input';
      inp.type      = 'text';
      inp.value     = data.profile.name;
      const save = () => {
        const v = inp.value.trim();
        if (v) { data.profile.name = v; saveProfile(); }
        updateProfile();
        ui.userNameWrapper.replaceChild(ui.userName, inp);
      };
      inp.addEventListener('blur',    save);
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
        saveProfile(); updateProfile();
        toast('Foto atualizada!');
      };
      reader.readAsDataURL(file);
    });
  }

  /* ══════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════ */
  function setupNav() {
    ui.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.view;
        ui.views.forEach(v => v.classList.toggle('hidden', v.id !== t));
        ui.navBtns.forEach(b => b.classList.toggle('active', b === btn));
        if (t === 'reports-view') renderChart();
      });
    });
  }

  /* ══════════════════════════════════════════════
     DATA — CARREGAR DO SUPABASE (com fallback cache)
  ══════════════════════════════════════════════ */
  async function loadData() {
    data.profile = loadProfile();

    if (navigator.onLine) {
      try {
        const fetched = await DB.fetchAll();
        data.products     = fetched.products;
        data.stock        = fetched.stock;
        data.salesHistory = fetched.salesHistory;
        data.stockHistory = fetched.stockHistory;
        DB.Cache.set(fetched);
        return;
      } catch (err) {
        console.warn('[loadData] Supabase falhou:', err);
        toast('Erro ao carregar — usando cache local', 'error');
      }
    }

    // Fallback: cache local
    const cached = DB.Cache.get();
    if (cached) {
      data.products     = cached.products     || [];
      data.stock        = cached.stock        || {};
      data.salesHistory = cached.salesHistory || [];
      data.stockHistory = cached.stockHistory || [];
      if (!navigator.onLine) toast('Sem internet — dados do último acesso', 'warn');
      return;
    }

    // Nenhum dado disponível
    data.products = DEFAULT_PRODUCTS.map(p => ({
      ...p, created_at: new Date().toISOString(),
    }));
    DEFAULT_PRODUCTS.forEach(p => { data.stock[p.id] = 0; });
    if (!navigator.onLine) toast('Sem internet e sem cache', 'warn');
  }

  async function reloadFromSupabase() {
    try {
      const fetched = await DB.fetchAll();
      data.products     = fetched.products;
      data.stock        = fetched.stock;
      data.salesHistory = fetched.salesHistory;
      data.stockHistory = fetched.stockHistory;
      DB.Cache.set(fetched);
      refresh();
    } catch (err) {
      console.warn('[reload] falhou:', err);
    }
  }

  /* ══════════════════════════════════════════════
     SELL VIEW
  ══════════════════════════════════════════════ */
  function updateDailySummary() {
    const tk   = todayKey();
    const stat = data.salesHistory.reduce((a, s) => {
      if (dateKey(s.date) === tk) { a.rev += s.quantity * s.price; a.pairs += s.quantity; }
      return a;
    }, { rev: 0, pairs: 0 });
    ui.dailyRevenue.textContent = fmt(stat.rev);
    ui.dailyPairs.textContent   = stat.pairs;
  }

  function renderProductPreview() {
    const ap = active();
    ui.productPreview.innerHTML = '';
    if (!ap.length) {
      ui.productPreview.innerHTML = '<p class="no-data-text">Nenhum produto ativo.</p>';
      return;
    }
    ap.forEach(p => {
      const q   = stockOf(p.id);
      const low = q > 0 && q <= LOW_STOCK;
      const el  = document.createElement('div');
      el.className = 'product-preview-card';
      el.innerHTML = `
        <p class="product-preview-name">${p.name}</p>
        <p class="product-preview-price">${fmt(p.price)}</p>
        <p class="product-preview-stock">${q} par${q !== 1 ? 'es' : ''} em estoque</p>
        ${low ? '<span class="badge-low-stock">⚠ Estoque Baixo</span>' : ''}
      `;
      ui.productPreview.appendChild(el);
    });
  }

  /* ── Sale Modal ── */
  function openSaleModal() {
    const ap = active();
    ui.productSelectGrid.innerHTML = '';
    if (!ap.length) {
      ui.productSelectGrid.innerHTML = '<p class="no-data-text" style="grid-column:1/-1">Cadastre produtos na aba Produtos.</p>';
    } else {
      ap.forEach(p => {
        const q   = stockOf(p.id);
        const btn = document.createElement('button');
        btn.className         = 'btn-product-select';
        btn.dataset.productId = p.id;
        btn.innerHTML = `
          <span class="btn-product-select-name">${p.name}</span>
          <span class="btn-product-select-price">${fmt(p.price)}</span>
          <span class="btn-product-select-stock">📦 ${q} em estoque</span>
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
    const p = getProduct(id);
    const q = stockOf(id);
    ui.saleProductTitle.textContent = `${p.name} — ${fmt(p.price)}`;
    ui.stockAvailHint.textContent   = `${q} par${q !== 1 ? 'es' : ''} disponível${q !== 1 ? 'is' : ''}`;
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

    if (!qty || qty <= 0) { toast('Insira uma quantidade válida.', 'error'); return; }
    if (qty > stock)       { toast(`Estoque insuficiente. Apenas ${stock} disponível.`, 'error'); return; }

    const p     = getProduct(saleProductId);
    const date  = new Date().toISOString();
    const saleId = genId();

    // Atualiza local imediatamente (otimista)
    data.stock[saleProductId] -= qty;
    data.salesHistory.unshift({ id: saleId, productId: saleProductId, quantity: qty, price: p.price, date });

    refresh();
    closeModal('sale-modal');
    toast('Venda registrada!');

    // Persiste no Supabase em background
    DB.registerSale(saleProductId, qty, p.price, date)
      .then(res => {
        if (res.queued) toast('Sem internet — venda na fila', 'warn');
        setConnStatus(navigator.onLine);
      })
      .catch(() => toast('Erro ao salvar no Supabase', 'error'));
  });

  ui.newSaleBtn.addEventListener('click', openSaleModal);

  /* ══════════════════════════════════════════════
     STOCK VIEW
  ══════════════════════════════════════════════ */
  function updateStockSummary() {
    let val = 0, qty = 0;
    data.products.forEach(p => { const q = stockOf(p.id); val += q * p.price; qty += q; });
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
      // Último histórico deste produto (stockHistory está ordem DESC)
      const last = data.stockHistory.find(h => h.productId === p.id);

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

    const date    = new Date().toISOString();
    const entryId = genId();

    // Atualiza local
    data.stock[productId] = (data.stock[productId] || 0) + qty;
    data.stockHistory.unshift({ id: entryId, productId, quantity: qty, date });

    refresh();
    toast(`${qty} par${qty > 1 ? 'es' : ''} adicionado${qty > 1 ? 's' : ''}!`);
    input.value = '';

    DB.addStock(productId, qty, date)
      .then(res => {
        if (res.queued) toast('Sem internet — estoque na fila', 'warn');
        setConnStatus(navigator.onLine);
      })
      .catch(() => toast('Erro ao salvar estoque', 'error'));
  }

  function undoStock(productId) {
    const last = data.stockHistory.find(h => h.productId === productId);
    if (!last) { toast('Nenhuma adição para desfazer.', 'error'); return; }
    if (stockOf(productId) < last.quantity) {
      toast('Não é possível desfazer — itens já vendidos.', 'error');
      return;
    }
    confirm('Desfazer Adição', `Remover +${last.quantity} do estoque?`, () => {
      data.stock[productId] -= last.quantity;
      data.stockHistory = data.stockHistory.filter(h => h.id !== last.id);
      refresh();
      toast('Adição desfeita!');

      DB.undoStock(last.id, productId, last.quantity)
        .then(res => {
          if (res.queued) toast('Será sincronizado ao reconectar', 'warn');
          setConnStatus(navigator.onLine);
        })
        .catch(() => toast('Erro ao desfazer no Supabase', 'error'));
    });
  }

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
    refresh();
    closeModal('edit-stock-modal');
    toast('Estoque atualizado!');

    DB.setStock(editStockId, qty)
      .then(res => {
        if (res.queued) toast('Será sincronizado ao reconectar', 'warn');
        setConnStatus(navigator.onLine);
      })
      .catch(() => toast('Erro ao salvar estoque', 'error'));
  });

  /* ══════════════════════════════════════════════
     REPORTS VIEW
  ══════════════════════════════════════════════ */
  function getFilteredSales() {
    const sv = ui.startDate.value, ev = ui.endDate.value, mv = ui.monthFilter.value;
    let sales = data.salesHistory.slice(), title = 'Relatório Geral';

    if (sv && ev) {
      const s = new Date(sv + 'T00:00:00'), e = new Date(ev + 'T23:59:59');
      sales = sales.filter(x => { const d = new Date(x.date); return d >= s && d <= e; });
      title = `${fmtDate(sv + 'T12:00:00')} — ${fmtDate(ev + 'T12:00:00')}`;
    } else if (mv && mv !== 'all') {
      sales = sales.filter(x => {
        const d = new Date(x.date);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === mv;
      });
      const [y, m] = mv.split('-');
      const mn = new Date(y, m-1).toLocaleString('pt-BR', { month:'long' });
      title = `${mn.charAt(0).toUpperCase() + mn.slice(1)} de ${y}`;
    }
    return { sales, title };
  }

  function updateReports() {
    const { sales, title } = getFilteredSales();
    ui.reportsTitle.textContent = title;

    const stats = sales.reduce((a, s) => {
      a.revenue += s.quantity * s.price; a.pairs += s.quantity;
      if (!a.byProduct[s.productId]) a.byProduct[s.productId] = { qty: 0 };
      a.byProduct[s.productId].qty += s.quantity;
      return a;
    }, { revenue: 0, pairs: 0, byProduct: {} });

    ui.totalRevenue.textContent   = fmt(stats.revenue);
    ui.totalPairsSold.textContent = stats.pairs;

    ui.productStatsList.innerHTML = '';
    data.products.forEach(p => {
      const ps  = stats.byProduct[p.id] || { qty: 0 };
      const row = document.createElement('div');
      row.className = 'product-stat-row';
      row.innerHTML = `
        <span class="product-stat-name">${p.name} (${fmt(p.price)})</span>
        <span class="product-stat-value">${ps.qty} pares</span>
      `;
      ui.productStatsList.appendChild(row);
    });

    renderHistory(sales);
  }

  function populateMonthFilter() {
    const months = new Set();
    data.salesHistory.forEach(s => {
      const d = new Date(s.date);
      months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    });
    const cur = ui.monthFilter.value;
    ui.monthFilter.innerHTML = '<option value="all">Todos os meses</option>';
    [...months].sort().reverse().forEach(m => {
      const [y, mo] = m.split('-');
      const name    = new Date(y, mo-1).toLocaleString('pt-BR', { month:'long' });
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
    if (!sorted.length) { ui.noSalesMsg.classList.remove('hidden'); return; }
    ui.noSalesMsg.classList.add('hidden');

    sorted.forEach(s => {
      const p  = getProduct(s.productId);
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div>
          <span class="history-item-name">${p ? p.name : 'Produto'} — ${p ? fmt(p.price) : ''}</span>
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
      refresh();
      toast('Venda removida e estoque devolvido!');

      DB.deleteSale(s.id, s.productId, s.quantity)
        .then(res => {
          if (res.queued) toast('Será sincronizado ao reconectar', 'warn');
          setConnStatus(navigator.onLine);
        })
        .catch(() => toast('Erro ao remover no Supabase', 'error'));
    });
  }

  function renderChart() {
    ui.salesChart.innerHTML = '';
    const days = [];
    const now  = new Date();
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now);
      d.setDate(d.getDate() - i);
      const key   = dateKey(d.toISOString());
      const label = i === 0 ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday:'short' }).replace('.', '');
      days.push({ key, label, rev: 0 });
    }
    data.salesHistory.forEach(s => {
      const day = days.find(d => d.key === dateKey(s.date));
      if (day) day.rev += s.quantity * s.price;
    });
    const maxRev = Math.max(...days.map(d => d.rev), 1);
    days.forEach(d => {
      const pct = Math.round((d.rev / maxRev) * 100);
      const col = document.createElement('div');
      col.className = 'chart-col';
      const valEl = document.createElement('span');
      valEl.className   = 'chart-bar-val';
      valEl.textContent = d.rev > 0 ? fmt(d.rev).replace('R$ ', '') : '';
      const bar = document.createElement('div');
      bar.className  = 'chart-bar' + (d.rev === 0 ? ' chart-bar-empty' : '');
      bar.style.height = `${Math.max(pct, d.rev > 0 ? 6 : 3)}px`;
      const dayEl = document.createElement('span');
      dayEl.className   = 'chart-bar-day';
      dayEl.textContent = d.label;
      col.appendChild(valEl); col.appendChild(bar); col.appendChild(dayEl);
      ui.salesChart.appendChild(col);
    });
  }

  ui.monthFilter.addEventListener('change', () => { ui.startDate.value = ''; ui.endDate.value = ''; updateReports(); });
  ui.startDate.addEventListener('change', () => { ui.monthFilter.value = 'all'; updateReports(); });
  ui.endDate.addEventListener('change',   () => { ui.monthFilter.value = 'all'; updateReports(); });

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
        refresh();
        toast(`Produto ${p.active ? 'ativado' : 'desativado'}!`);
        DB.toggleProduct(p.id, p.active)
          .then(res => { if (res.queued) toast('Será sincronizado ao reconectar', 'warn'); setConnStatus(navigator.onLine); })
          .catch(() => toast('Erro ao atualizar produto', 'error'));
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
      p.name  = name; p.price = price;
      toast('Produto atualizado!');
      DB.updateProduct(editingProductId, name, price)
        .then(res => { if (res.queued) toast('Será sincronizado ao reconectar', 'warn'); setConnStatus(navigator.onLine); })
        .catch(() => toast('Erro ao salvar produto', 'error'));
    } else {
      const newId  = 'p_' + Date.now();
      const newProd = { id: newId, name, price, active: true, created_at: new Date().toISOString() };
      data.products.push(newProd);
      data.stock[newId] = 0;
      toast('Produto adicionado!');
      DB.insertProduct(newProd)
        .then(res => { if (res.queued) toast('Será sincronizado ao reconectar', 'warn'); setConnStatus(navigator.onLine); })
        .catch(() => toast('Erro ao salvar produto', 'error'));
    }

    refresh();
    closeModal('product-modal');
  });

  /* ══════════════════════════════════════════════
     EXPORT / IMPORT  (permanecem locais)
  ══════════════════════════════════════════════ */
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (!data.salesHistory.length) { toast('Nenhuma venda para exportar.', 'error'); return; }
    const cols = ['Data','Hora','Produto','Quantidade','Preço Unitário','Total'];
    const rows = data.salesHistory.slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(s => {
        const d = new Date(s.date);
        const p = getProduct(s.productId);
        return [
          d.toLocaleDateString('pt-BR'),
          d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
          p ? p.name : 'Produto',
          s.quantity,
          s.price.toFixed(2).replace('.', ','),
          (s.quantity * s.price).toFixed(2).replace('.', ','),
        ].join(';');
      });
    const csv  = [cols.join(';'), ...rows].join('\r\n');
    downloadBlob(new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8;' }), `vendas_jose_${new Date().toISOString().slice(0,10)}.csv`);
    toast('CSV exportado!');
  }

  function exportBackup() {
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }), `backup_jose_${new Date().toISOString().slice(0,10)}.json`);
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
          async () => {
            // Restaurar localmente
            if (parsed.products)     data.products     = parsed.products;
            if (parsed.stock)        data.stock        = parsed.stock;
            if (parsed.salesHistory) data.salesHistory = parsed.salesHistory;
            if (parsed.stockHistory) data.stockHistory = parsed.stockHistory;
            if (parsed.profile)      { data.profile = parsed.profile; saveProfile(); }
            DB.Cache.set({ products: data.products, stock: data.stock, salesHistory: data.salesHistory, stockHistory: data.stockHistory });
            refresh(); updateProfile();
            toast('Backup restaurado! (os dados serão sincronizados ao Supabase na próxima ação)');
          }
        );
      } catch { toast('Arquivo inválido.', 'error'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  /* ══════════════════════════════════════════════
     REFRESH COMPLETO DA UI
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
  async function init() {
    setupNav();
    setupProfile();

    // Mostra loading enquanto busca do Supabase
    ui.views.forEach(v => { if (!v.classList.contains('hidden')) {
      v.innerHTML = '<div class="view-inner"><p class="no-data-text">Carregando dados…</p></div>';
    }});

    await loadData();
    updateProfile();
    refresh();
    setupConnectionStatus();

    // Processar fila offline residual ao iniciar
    if (navigator.onLine && DB.queueLength() > 0) {
      const n = await DB.processQueue();
      if (n > 0) {
        toast(`${n} ação(ões) sincronizada(s) da fila!`);
        await reloadFromSupabase();
      }
    }
  }

  init();
});
