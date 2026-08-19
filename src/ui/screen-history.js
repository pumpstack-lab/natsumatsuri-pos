import { esc } from './escape.js';
import { state, go, render } from './state.js';
import { summarize, productBreakdown } from '../core/summary.js';
import { editSaleItems, voidSale } from '../core/sale.js';
import { cartTotal } from '../core/money.js';
import { availableProducts } from '../core/products.js';
import { emptyCashTaps, tapsTotal, VOUCHER_VALUE } from '../core/cash.js';
import { calcChange } from '../core/money.js';
import { putSale } from '../db.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function mySales() {
  return state.sales.filter((s) => s.terminal === state.terminal);
}

function hhmm(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

let draft = null;
let draftReceived = null;   // 修正中の預かり金（null = 記録なし）
let draftTaps = null;       // 金額ボタンのタップ回数
let draftVouchers = 0;      // 修正中の商品券の枚数

function openEdit(sale) {
  state.editingSaleId = sale.id;
  draft = sale.items.map((i) => ({ ...i }));
  draftReceived = sale.received;
  draftTaps = emptyCashTaps();
  draftVouchers = sale.vouchers ?? 0;
  render();
}

function closeEdit() {
  state.editingSaleId = null;
  draft = null;
  draftReceived = null;
  draftTaps = null;
  draftVouchers = 0;
  render();
}

// 金額ボタンを押すと積み上がる（登録画面と同じ操作感）
function tapEditCash(value) {
  draftTaps[value] += 1;
  draftReceived = tapsTotal(draftTaps);
  render();
}

function clearEditCash() {
  draftTaps = emptyCashTaps();
  draftReceived = null;
  draftVouchers = 0;
  render();
}

async function saveEdit(sale) {
  const items = draft.filter((i) => i.qty > 0);
  if (items.length === 0) {
    alert('商品が0件です。取消する場合は「この会計を取消」を押してください。');
    return;
  }
  const updated = editSaleItems(sale, items, new Date().toISOString(), { received: draftReceived, vouchers: draftVouchers });
  await putSale(updated);
  const idx = state.sales.findIndex((s) => s.id === sale.id);
  state.sales[idx] = updated;
  closeEdit();
}

async function doVoid(sale) {
  if (!confirm(`顧客 ${sale.seq} の会計 ${YEN(sale.total)} を取消します。よろしいですか？\n\n（履歴には残り、売上から除外されます）`)) return;
  const updated = voidSale(sale, new Date().toISOString());
  await putSale(updated);
  const idx = state.sales.findIndex((s) => s.id === sale.id);
  state.sales[idx] = updated;
  closeEdit();
}

function sheetHtml(sale) {
  const total = cartTotal(draft.filter((i) => i.qty > 0));
  const { change, shortage } = calcChange(total, draftReceived, draftVouchers * VOUCHER_VALUE);
  const addable = availableProducts(state.products, state.terminal)
    .filter((p) => !draft.some((i) => i.product_id === p.id));

  return `
    <div class="sheet-bg" data-sheet-bg>
      <div class="sheet">
        <div class="sheet__head">
          <span class="sheet__title">顧客 ${sale.seq} を修正 <span style="font-weight:500;color:var(--gray);font-size:13px">${hhmm(sale.created_at)}</span></span>
          <button class="bar__btn" data-close>閉じる</button>
        </div>
        ${draft.map((i) => `
          <div class="sheet__row">
            <span>${esc(i.name)} <span style="color:var(--gray);font-size:12px">${YEN(i.unit_price)}</span></span>
            <span class="cart__qty">
              <button data-dminus="${esc(i.product_id)}">−</button>
              <span>${i.qty}</span>
              <button data-dplus="${esc(i.product_id)}">＋</button>
            </span>
          </div>
        `).join('')}
        ${addable.length > 0 ? `
          <select class="field" data-addsel>
            <option value="">＋ 商品を追加</option>
            ${addable.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} ${YEN(p.price)}</option>`).join('')}
          </select>
        ` : ''}
        <div class="sheet__total">
          <span>修正後の合計</span>
          <strong>${YEN(total)}</strong>
        </div>

        <div class="sheet__cash">
          <div class="sheet__cash-label">預かり金・商品券</div>
          <div class="cashcol">
            <div class="cashcol__row">
              <button data-ecash="100" class="${draftTaps[100] > 0 ? 'is-on' : ''}">¥100${draftTaps[100] > 0 ? `<small>×${draftTaps[100]}</small>` : ''}</button>
              <button data-ecash="1000" class="${draftTaps[1000] > 0 ? 'is-on' : ''}">¥1,000${draftTaps[1000] > 0 ? `<small>×${draftTaps[1000]}</small>` : ''}</button>
            </div>
            <div class="cashcol__row">
              <button data-ecash="5000" class="${draftTaps[5000] > 0 ? 'is-on' : ''}">¥5,000${draftTaps[5000] > 0 ? `<small>×${draftTaps[5000]}</small>` : ''}</button>
              <button data-ecash="10000" class="${draftTaps[10000] > 0 ? 'is-on' : ''}">¥10,000${draftTaps[10000] > 0 ? `<small>×${draftTaps[10000]}</small>` : ''}</button>
            </div>
            <div class="cashcol__row">
              <button data-evoucher class="cashcol__voucher ${draftVouchers > 0 ? 'is-on' : ''}">商品券${draftVouchers > 0 ? `<small>×${draftVouchers}</small>` : `<small>${YEN(VOUCHER_VALUE)}</small>`}</button>
              <button data-eclear class="cashcol__clear">クリア</button>
            </div>
          </div>
          <div class="cashinfo">
            ${draftVouchers > 0 ? `
              <div class="pay__voucher">
                <span>商品券 ${draftVouchers}枚</span>
                <strong>−${YEN(draftVouchers * VOUCHER_VALUE)}</strong>
              </div>
            ` : ''}
            <div class="pay__recv ${draftReceived === null ? 'is-empty' : ''}">
              <span>預かり</span>
              <strong>${draftReceived === null ? '—' : YEN(draftReceived)}</strong>
            </div>
            <div class="pay__change ${draftReceived === null ? 'is-empty' : shortage > 0 ? 'is-short' : ''}">
              <span>${shortage > 0 ? '不足' : 'お釣り'}</span>
              <strong>${draftReceived === null ? '—' : YEN(shortage > 0 ? shortage : change)}</strong>
            </div>
            ${draftReceived !== null && shortage > 0 ? '<div class="sheet__warn">預かり金が足りません。このまま保存すると預かり・お釣りの記録は消えます。</div>' : ''}
          </div>
        </div>

        <button class="btn-primary" data-save>修正を保存</button>
        <div style="height:8px"></div>
        <button class="btn-danger" data-void>この会計を取消</button>
      </div>
    </div>
  `;
}

export function renderHistory() {
  const el = document.createElement('div');
  el.className = 'screen';

  const sales = mySales();
  const sum = summarize(sales);
  const label = state.terminal === 'food' ? '🍔 フード窓口' : '🥤 ドリンク窓口';
  const editing = state.editingSaleId ? sales.find((s) => s.id === state.editingSaleId) : null;

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">${label} の履歴</span>
      <button class="bar__btn" data-go="export">書き出し</button>
    </div>
    <div class="kpi">
      <div class="kpi__box kpi__box--main">
        <div class="kpi__label">この端末の売上</div>
        <div class="kpi__value">${YEN(sum.totalSales)}</div>
      </div>
      <div class="kpi__box">
        <div class="kpi__label">会計数</div>
        <div class="kpi__value">${sum.count}</div>
      </div>
      <div class="kpi__box">
        <div class="kpi__label">平均単価</div>
        <div class="kpi__value">${YEN(sum.average)}</div>
      </div>
      <div class="kpi__box">
        <div class="kpi__label">商品券</div>
        <div class="kpi__value">${sum.voucherCount}<span style="font-size:13px;font-weight:600;color:var(--gray)">枚</span></div>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="list" class="${state.historyTab === 'list' ? 'is-on' : ''}">会計履歴</button>
      <button data-tab="product" class="${state.historyTab === 'product' ? 'is-on' : ''}">商品別集計</button>
    </div>
    <div class="scroll">
      ${state.historyTab === 'list' ? `
        <div class="recs">
          ${sales.length === 0 ? '<div class="cart__empty">まだ会計がありません</div>' : sales.map((s) => `
            <button class="rec ${s.status === 'voided' ? 'rec--void' : s.edited ? 'rec--edited' : ''}" data-edit="${s.id}">
              <div class="rec__head">
                <span class="rec__no">顧客 ${s.seq}${s.status === 'voided' ? '<span class="tag tag--void">取消</span>' : s.edited ? '<span class="tag">修正済</span>' : ''}</span>
                <span class="rec__amount">${YEN(s.total)}</span>
              </div>
              <div class="rec__body">
                <span>${s.items.map((i) => `${esc(i.name)}×${i.qty}`).join(', ')}${(s.vouchers ?? 0) > 0 ? ` · 券${s.vouchers}枚` : ''}${s.received !== null ? ` · 預${YEN(s.received)} / 釣${YEN(s.change)}` : ''}</span>
                <span>${hhmm(s.created_at)}</span>
              </div>
            </button>
          `).join('')}
        </div>
      ` : `
        <div class="pbreak">
          ${productBreakdown(sales).length === 0 ? '<div class="cart__empty">まだ会計がありません</div>' : productBreakdown(sales).map((p) => `
            <div class="pbreak__row">
              <span>${esc(p.name)}</span>
              <span><strong>${p.qty}</strong> / ${YEN(p.amount)}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
    ${editing ? sheetHtml(editing) : ''}
  `;

  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    state.historyTab = b.dataset.tab;
    render();
  }));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const s = sales.find((x) => x.id === b.dataset.edit);
    if (s && s.status === 'active') openEdit(s);
    else if (s) alert('取消済みの会計は編集できません。');
  }));

  if (editing) {
    el.querySelector('[data-close]').addEventListener('click', closeEdit);
    el.querySelector('[data-sheet-bg]').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeEdit();
    });
    el.querySelectorAll('[data-dplus]').forEach((b) => b.addEventListener('click', () => {
      const i = draft.find((x) => x.product_id === b.dataset.dplus);
      i.qty += 1;
      render();
    }));
    el.querySelectorAll('[data-dminus]').forEach((b) => b.addEventListener('click', () => {
      const i = draft.find((x) => x.product_id === b.dataset.dminus);
      i.qty -= 1;
      if (i.qty <= 0) draft = draft.filter((x) => x.product_id !== b.dataset.dminus);
      render();
    }));
    const sel = el.querySelector('[data-addsel]');
    if (sel) sel.addEventListener('change', () => {
      const p = state.products.find((x) => x.id === sel.value);
      if (p) {
        draft.push({ product_id: p.id, name: p.name, unit_price: p.price, qty: 1 });
        render();
      }
    });
    el.querySelectorAll('[data-ecash]').forEach((b) => b.addEventListener('click', () => tapEditCash(Number(b.dataset.ecash))));
    el.querySelector('[data-evoucher]').addEventListener('click', () => {
      draftVouchers += 1;
      render();
    });
    el.querySelector('[data-eclear]').addEventListener('click', clearEditCash);
    el.querySelector('[data-save]').addEventListener('click', () => saveEdit(editing));
    el.querySelector('[data-void]').addEventListener('click', () => doVoid(editing));
  }

  return el;
}
