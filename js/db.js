'use strict';

/* ══════════════════════════════════════════════
   SUPABASE CLIENT
   Tabelas: jose_produtos · jose_estoque
            jose_vendas  · jose_historico_estoque
   ⚠️ 'total' em jose_vendas é GERADO pelo banco —
      NUNCA inserir esse campo manualmente.
══════════════════════════════════════════════ */
const _sb = supabase.createClient(
  'https://ntabjivonxmaxdiwxtda.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YWJqaXZvbnhtYXhkaXd4dGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTAzNDQsImV4cCI6MjA5Nzg4NjM0NH0.zwtH8WdgH2-TUrAbY1Zfs47_YuaAiNu30DJVifQO0A0'
);

/* ══════════════════════════════════════════════
   CACHE  (último estado bem-sucedido do Supabase)
   QUEUE  (ações pendentes enquanto offline)
══════════════════════════════════════════════ */
const CACHE_KEY = 'jose_cache';
const QUEUE_KEY = 'jose_offline_queue';

const Cache = {
  get() {
    try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  },
  set(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _at: Date.now() })); }
    catch {}
  },
};

const Queue = {
  get()      { try { const r = localStorage.getItem(QUEUE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } },
  add(a)     { const q = this.get(); q.push({ ...a, _qid: crypto.randomUUID() }); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); },
  remove(id) { localStorage.setItem(QUEUE_KEY, JSON.stringify(this.get().filter(a => a._qid !== id))); },
  count()    { return this.get().length; },
};

/* ══════════════════════════════════════════════
   MAPEAMENTO  Supabase → modelo local
══════════════════════════════════════════════ */
const map = {
  product:    p => ({ id: p.id, name: p.nome, price: Number(p.preco), active: p.ativo, created_at: p.criado_em }),
  sale:       s => ({ id: s.id, productId: s.produto_id, quantity: Number(s.quantidade), price: Number(s.preco_unitario), date: s.vendido_em }),
  stockEntry: h => ({ id: h.id, productId: h.produto_id, quantity: Number(h.quantidade), date: h.adicionado_em }),
};

/* ══════════════════════════════════════════════
   WRAPPER OFFLINE
   Tenta executar fn(); se offline → enfileira.
══════════════════════════════════════════════ */
async function withOffline(fn, entry) {
  if (!navigator.onLine) { Queue.add(entry); return { queued: true }; }
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (!navigator.onLine) { Queue.add(entry); return { queued: true }; }
    throw err;
  }
}

/* ══════════════════════════════════════════════
   DB — operações públicas
══════════════════════════════════════════════ */
const DB = {

  /* ── Carregar tudo ── */
  async fetchAll() {
    const [p, e, v, h] = await Promise.all([
      _sb.from('jose_produtos').select('*').order('preco'),
      _sb.from('jose_estoque').select('*'),
      _sb.from('jose_vendas')
         .select('id,produto_id,quantidade,preco_unitario,vendido_em')
         .order('vendido_em', { ascending: false })
         .limit(500),
      _sb.from('jose_historico_estoque')
         .select('*')
         .order('adicionado_em', { ascending: false })
         .limit(200),
    ]);
    if (p.error) throw p.error;
    if (e.error) throw e.error;
    if (v.error) throw v.error;
    if (h.error) throw h.error;

    const stock = {};
    e.data.forEach(r => { stock[r.produto_id] = r.quantidade; });

    return {
      products:     p.data.map(map.product),
      stock,
      salesHistory: v.data.map(map.sale),
      stockHistory: h.data.map(map.stockEntry),
    };
  },

  /* ── Registrar venda ── */
  async registerSale(productId, quantity, price, date) {
    return withOffline(
      () => this._registerSale(productId, quantity, price, date),
      { type: 'SALE', productId, quantity, price, date }
    );
  },
  async _registerSale(productId, quantity, price, date) {
    // ⚠️ Nunca incluir 'total' — campo gerado pelo banco
    const { error: e1 } = await _sb.from('jose_vendas').insert({
      produto_id: productId, quantidade: quantity,
      preco_unitario: price, vendido_em: date,
    });
    if (e1) throw e1;

    const { data: row, error: e2 } = await _sb
      .from('jose_estoque').select('quantidade').eq('produto_id', productId).single();
    if (e2) throw e2;

    const { error: e3 } = await _sb.from('jose_estoque')
      .update({ quantidade: row.quantidade - quantity, atualizado_em: new Date().toISOString() })
      .eq('produto_id', productId);
    if (e3) throw e3;
  },

  /* ── Adicionar estoque ── */
  async addStock(productId, quantity, date) {
    return withOffline(
      () => this._addStock(productId, quantity, date),
      { type: 'ADD_STOCK', productId, quantity, date }
    );
  },
  async _addStock(productId, quantity, date) {
    const { error: e1 } = await _sb.from('jose_historico_estoque').insert({
      produto_id: productId, quantidade: quantity, adicionado_em: date,
    });
    if (e1) throw e1;

    const { data: row, error: e2 } = await _sb
      .from('jose_estoque').select('quantidade').eq('produto_id', productId).single();
    if (e2) throw e2;

    const { error: e3 } = await _sb.from('jose_estoque')
      .update({ quantidade: row.quantidade + quantity, atualizado_em: new Date().toISOString() })
      .eq('produto_id', productId);
    if (e3) throw e3;
  },

  /* ── Editar estoque (manual) ── */
  async setStock(productId, quantity) {
    return withOffline(
      () => this._setStock(productId, quantity),
      { type: 'SET_STOCK', productId, quantity }
    );
  },
  async _setStock(productId, quantity) {
    const { error } = await _sb.from('jose_estoque')
      .update({ quantidade: quantity, atualizado_em: new Date().toISOString() })
      .eq('produto_id', productId);
    if (error) throw error;
  },

  /* ── Deletar venda ── */
  async deleteSale(saleId, productId, quantity) {
    return withOffline(
      () => this._deleteSale(saleId, productId, quantity),
      { type: 'DELETE_SALE', saleId, productId, quantity }
    );
  },
  async _deleteSale(saleId, productId, quantity) {
    const { error: e1 } = await _sb.from('jose_vendas').delete().eq('id', saleId);
    if (e1) throw e1;

    const { data: row, error: e2 } = await _sb
      .from('jose_estoque').select('quantidade').eq('produto_id', productId).single();
    if (e2) throw e2;

    const { error: e3 } = await _sb.from('jose_estoque')
      .update({ quantidade: row.quantidade + quantity, atualizado_em: new Date().toISOString() })
      .eq('produto_id', productId);
    if (e3) throw e3;
  },

  /* ── Desfazer adição de estoque ── */
  async undoStock(entryId, productId, quantity) {
    return withOffline(
      () => this._undoStock(entryId, productId, quantity),
      { type: 'UNDO_STOCK', entryId, productId, quantity }
    );
  },
  async _undoStock(entryId, productId, quantity) {
    const { error: e1 } = await _sb.from('jose_historico_estoque').delete().eq('id', entryId);
    if (e1) throw e1;

    const { data: row, error: e2 } = await _sb
      .from('jose_estoque').select('quantidade').eq('produto_id', productId).single();
    if (e2) throw e2;

    const { error: e3 } = await _sb.from('jose_estoque')
      .update({ quantidade: row.quantidade - quantity, atualizado_em: new Date().toISOString() })
      .eq('produto_id', productId);
    if (e3) throw e3;
  },

  /* ── Produtos CRUD ── */
  async insertProduct(product) {
    return withOffline(
      () => this._insertProduct(product),
      { type: 'INSERT_PRODUCT', product }
    );
  },
  async _insertProduct(product) {
    const { error: e1 } = await _sb.from('jose_produtos')
      .insert({ id: product.id, nome: product.name, preco: product.price, ativo: true });
    if (e1) throw e1;

    const { error: e2 } = await _sb.from('jose_estoque')
      .insert({ produto_id: product.id, quantidade: 0 });
    if (e2) throw e2;
  },

  async updateProduct(id, name, price) {
    return withOffline(
      () => this._updateProduct(id, name, price),
      { type: 'UPDATE_PRODUCT', id, name, price }
    );
  },
  async _updateProduct(id, name, price) {
    const { error } = await _sb.from('jose_produtos').update({ nome: name, preco: price }).eq('id', id);
    if (error) throw error;
  },

  async toggleProduct(id, active) {
    return withOffline(
      () => this._toggleProduct(id, active),
      { type: 'TOGGLE_PRODUCT', id, active }
    );
  },
  async _toggleProduct(id, active) {
    const { error } = await _sb.from('jose_produtos').update({ ativo: active }).eq('id', id);
    if (error) throw error;
  },

  /* ── Processar fila offline ── */
  async processQueue() {
    const queue = Queue.get();
    if (!queue.length) return 0;
    let count = 0;
    for (const action of queue) {
      try {
        await this._run(action);
        Queue.remove(action._qid);
        count++;
      } catch (err) {
        console.warn('[Queue] falhou:', action.type, err);
        break; // preserva ordem
      }
    }
    return count;
  },
  async _run(a) {
    const m = {
      SALE:           () => this._registerSale(a.productId, a.quantity, a.price, a.date),
      ADD_STOCK:      () => this._addStock(a.productId, a.quantity, a.date),
      SET_STOCK:      () => this._setStock(a.productId, a.quantity),
      DELETE_SALE:    () => this._deleteSale(a.saleId, a.productId, a.quantity),
      UNDO_STOCK:     () => this._undoStock(a.entryId, a.productId, a.quantity),
      INSERT_PRODUCT: () => this._insertProduct(a.product),
      UPDATE_PRODUCT: () => this._updateProduct(a.id, a.name, a.price),
      TOGGLE_PRODUCT: () => this._toggleProduct(a.id, a.active),
    };
    if (m[a.type]) return m[a.type]();
    console.warn('[Queue] tipo desconhecido:', a.type);
  },

  queueLength: () => Queue.count(),
  Cache,
};
