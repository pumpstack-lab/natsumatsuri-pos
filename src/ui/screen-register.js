import { esc } from './escape.js';
import { state, go, render, resetCart, nextSeq } from './state.js';
import { availableProducts } from '../core/products.js';
import { cartTotal, calcChange } from '../core/money.js';
import { createSale } from '../core/sale.js';
import { CASH_UNITS, emptyCashTaps, tapsTotal } from '../core/cash.js';
import { putSale } from '../db.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function receivedTotal() {
  const fromTaps = tapsTotal(state.cashTaps);
  const total = fromTaps + state.otherAmount;
  return total === 0 ? null : total;
}

function addItem(product) {
  const found = state.cart.find((i) => i.product_id === product.id);
  if (found) {
    found.qty += 1;
  } else {
    state.cart.push({ product_id: product.id, name: product.name, unit_price: product.price, qty: 1 });
  }
  render();
}

function changeQty(productId, delta) {
  const item = state.cart.find((i) => i.product_id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter((i) => i.product_id !== productId);
  }
  render();
}

function tapCash(value) {
  state.cashTaps[value] += 1;
  render();
}

function clearCash() {
  state.cashTaps = emptyCashTaps();
  state.otherAmount = 0;
  state.keypadOpen = false;
  render();
}

// 保存中フラグ。屋台で急いで2連打された時に同じ会計が二重登録されるのを防ぐ。
// （実測：ダブルクリック相当の操作で¥500の会計が2件¥1,000として登録された）
let saving = false;

async function complete() {
  if (saving) return;

  const total = cartTotal(state.cart);
  const received = receivedTotal();
  const { canComplete } = calcChange(total, received);
  if (!canComplete) return;

  saving = true;
  const btn = document.querySelector('[data-done]');
  if (btn) btn.disabled = true;

  const sale = createSale({
    terminal: state.terminal,
    seq: nextSeq(state.terminal),
    items: state.cart,
    received,
    now: new Date().toISOString(),
  });

  try {
    await putSale(sale);
  } catch (e) {
    // 保存に失敗したら伝票を残したまま知らせる。
    // 黙って戻すと「押せていない」と誤解され、二重に打たれる。
    if (btn) btn.disabled = false;
    saving = false;
    alert('保存できませんでした。もう一度「支払い完了」を押してください。\n\n何度も失敗する場合は紙の伝票に切り替えてください。');
    return;
  }

  state.sales.unshift(sale);
  showToast(`顧客 ${sale.seq}　${YEN(sale.total)} を登録しました`);
  resetCart();
  saving = false;
  render();
}

// 支払い完了の確認ダイアログは意図的に入れない（速度優先）。
// 代わりに登録内容を短く表示して、押し間違いにその場で気付けるようにする。
function showToast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 1300);
  setTimeout(() => el.remove(), 1800);
}

function keypadHtml() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];
  return `
    <div class="keypad">
      ${keys.map((k) => `<button data-key="${k}">${k}</button>`).join('')}
    </div>
  `;
}

export function renderRegister() {
  const el = document.createElement('div');
  el.className = 'screen';

  const products = availableProducts(state.products, state.terminal);
  const total = cartTotal(state.cart);
  const received = receivedTotal();
  const { change, shortage, canComplete } = calcChange(total, received);
  const label = state.terminal === 'food' ? '🍔 フード' : '🥤 ドリンク';
  const seq = nextSeq(state.terminal);

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">${label}</span>
      <span class="bar__btn" style="color:var(--gray)">顧客 ${seq}組目</span>
    </div>
    <div class="reg">
      <div class="reg__grid">
        ${products.map((p) => `
          <button class="pbtn" data-add="${esc(p.id)}">
            <span class="pbtn__name">${esc(p.name)}</span>
            <span class="pbtn__price">${YEN(p.price)}</span>
          </button>
        `).join('')}
      </div>
      <div class="cart">
        <div class="cart__list">
          ${state.cart.length === 0
            ? '<div class="cart__empty">商品をタップしてください</div>'
            : state.cart.map((i) => `
              <div class="cart__row">
                <span>${esc(i.name)} <span style="color:var(--gray)">${YEN(i.unit_price)}</span></span>
                <span class="cart__qty">
                  <button data-minus="${esc(i.product_id)}">−</button>
                  <span>${i.qty}</span>
                  <button data-plus="${esc(i.product_id)}">＋</button>
                  <strong style="min-width:72px;text-align:right">${YEN(i.unit_price * i.qty)}</strong>
                </span>
              </div>
            `).join('')}
        </div>
        <div class="cart__total">
          <span>${state.cart.length}点 / 合計</span>
          <strong>${YEN(total)}</strong>
        </div>
      </div>
      <div class="pay">
        <div class="pay__cash">
          ${CASH_UNITS.map((v) => `
            <button data-cash="${v}" class="${state.cashTaps[v] > 0 ? 'is-on' : ''}">
              ${YEN(v)}${state.cashTaps[v] > 0 ? `<small>×${state.cashTaps[v]}</small>` : ''}
            </button>
          `).join('')}
          <button data-other style="color:var(--blue);border-color:var(--blue)">その他</button>
        </div>
        ${state.keypadOpen ? keypadHtml() : ''}
        ${received !== null ? `
          <div class="pay__recv">
            <span>預かり</span>
            <span><strong>${YEN(received)}</strong> <button data-clear>クリア</button></span>
          </div>
          <div class="pay__change ${shortage > 0 ? 'is-short' : ''}">
            <span>${shortage > 0 ? '不足' : 'お釣り'}</span>
            <strong>${YEN(shortage > 0 ? shortage : change)}</strong>
          </div>
        ` : ''}
        <button class="pay__done" data-done ${canComplete ? '' : 'disabled'}>支払い完了</button>
      </div>
    </div>
  `;

  el.querySelector('[data-go="top"]').addEventListener('click', () => go('top'));
  el.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = products.find((x) => x.id === btn.dataset.add);
      if (p) addItem(p);
    });
  });
  el.querySelectorAll('[data-plus]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.plus, 1));
  });
  el.querySelectorAll('[data-minus]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.minus, -1));
  });
  el.querySelectorAll('[data-cash]').forEach((btn) => {
    btn.addEventListener('click', () => tapCash(Number(btn.dataset.cash)));
  });
  el.querySelector('[data-other]').addEventListener('click', () => {
    state.keypadOpen = !state.keypadOpen;
    render();
  });
  const clearBtn = el.querySelector('[data-clear]');
  if (clearBtn) clearBtn.addEventListener('click', clearCash);
  el.querySelectorAll('[data-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      let s = String(state.otherAmount);
      if (k === '⌫') s = s.slice(0, -1) || '0';
      else if (k === '00') s = s === '0' ? '0' : s + '00';
      else s = s === '0' ? k : s + k;
      state.otherAmount = Number(s.slice(0, 7));
      render();
    });
  });
  el.querySelector('[data-done]').addEventListener('click', complete);

  return el;
}
