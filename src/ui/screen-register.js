import { esc } from './escape.js';
import { state, go, render, resetCart, nextSeq } from './state.js';
import { availableProducts } from '../core/products.js';
import { cartTotal, calcChange } from '../core/money.js';
import { createSale, voidSale } from '../core/sale.js';
import { CASH_UNITS, emptyCashTaps, tapsTotal, VOUCHER_VALUE } from '../core/cash.js';
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
  state.vouchers = 0;
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
  const { canComplete } = calcChange(total, received, state.vouchers * VOUCHER_VALUE);
  if (!canComplete) return;

  saving = true;
  const btn = document.querySelector('[data-done]');
  if (btn) btn.disabled = true;

  const sale = createSale({
    terminal: state.terminal,
    seq: nextSeq(state.terminal),
    items: state.cart,
    received,
    vouchers: state.vouchers,
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

// 誤って支払い完了した直前の会計を取り消し、内容を編集中の伝票に復元する。
// 取消レコードは履歴に残す（集計の追跡可能性を守る・本ツール共通の方針）。
async function undoLast() {
  const last = state.sales.find((s) => s.terminal === state.terminal && s.status === 'active');
  if (!last) {
    alert('修正できる会計がありません。');
    return;
  }
  const summary = last.items.map((i) => `${i.name}×${i.qty}`).join(', ');
  const warn = state.cart.length > 0 ? '\n\n※いま入力中の伝票は消えます。' : '';
  if (!confirm(`直前の会計（顧客 ${last.seq}・${YEN(last.total)}）を取り消して、内容を編集に戻します。\n${summary}${warn}\n\nよろしいですか？`)) return;

  const voided = voidSale(last, new Date().toISOString());
  try {
    await putSale(voided);
  } catch (e) {
    alert('取消を保存できませんでした。もう一度お試しください。');
    return;
  }
  const idx = state.sales.findIndex((s) => s.id === last.id);
  state.sales[idx] = voided;

  // 会計内容を編集中の状態へ復元（預かり金は合計額として「その他」枠に入れる）
  state.cart = last.items.map((i) => ({ ...i }));
  state.cashTaps = emptyCashTaps();
  state.otherAmount = last.received ?? 0;
  state.vouchers = last.vouchers ?? 0;
  state.keypadOpen = false;
  showToast(`顧客 ${last.seq} を取り消し、内容を編集に戻しました`);
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
  const voucherAmount = state.vouchers * VOUCHER_VALUE;
  const { change, shortage, canComplete, cashDue } = calcChange(total, received, voucherAmount);
  const label = state.terminal === 'food' ? '🍔 フード' : '🥤 ドリンク';
  const seq = nextSeq(state.terminal);

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">${label}</span>
      <span class="bar__actions">
        <button class="bar__btn" data-undo>↩ 直前を修正</button>
        <button class="bar__btn" data-go2="history">📋 履歴・集計</button>
        <span class="bar__seq">顧客 ${seq}組目</span>
      </span>
    </div>
    <div class="reg">
      <div class="reg__grid ${products.length > 6 ? 'reg__grid--dense' : ''}">
        ${products.map((p) => `
          <button class="pbtn pbtn--${state.terminal}" data-add="${esc(p.id)}">
            <span class="pbtn__name">${esc(p.name)}</span>
            <span class="pbtn__price">${YEN(p.price)}</span>
          </button>
        `).join('')}
      </div>
      <div class="lower">
        <div class="lower__left">
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
                    <strong style="min-width:80px;text-align:right">${YEN(i.unit_price * i.qty)}</strong>
                  </span>
                </div>
              `).join('')}
          </div>
          <div class="cart__total">
            <span>${state.cart.length}点 / 合計</span>
            <strong>${YEN(total)}</strong>
          </div>
        </div>
        <div class="lower__right">
          <!-- 預かり金ボタンは右側の縦固定パネル。伝票が増えても預かり/お釣りが出ても絶対に動かない
               （連打時に1回目でボタンがずれて2回目が空振りするストレスを解消・2026-08-19 オーナー指摘） -->
          <div class="cashcol">
            <div class="cashcol__row">
              <button data-cash="100" class="${state.cashTaps[100] > 0 ? 'is-on' : ''}">¥100${state.cashTaps[100] > 0 ? `<small>×${state.cashTaps[100]}</small>` : ''}</button>
              <button data-cash="1000" class="${state.cashTaps[1000] > 0 ? 'is-on' : ''}">¥1,000${state.cashTaps[1000] > 0 ? `<small>×${state.cashTaps[1000]}</small>` : ''}</button>
            </div>
            <div class="cashcol__row">
              <button data-cash="5000" class="${state.cashTaps[5000] > 0 ? 'is-on' : ''}">¥5,000${state.cashTaps[5000] > 0 ? `<small>×${state.cashTaps[5000]}</small>` : ''}</button>
              <button data-cash="10000" class="${state.cashTaps[10000] > 0 ? 'is-on' : ''}">¥10,000${state.cashTaps[10000] > 0 ? `<small>×${state.cashTaps[10000]}</small>` : ''}</button>
            </div>
            <div class="cashcol__row">
              <button data-voucher class="cashcol__voucher ${state.vouchers > 0 ? 'is-on' : ''}">商品券${state.vouchers > 0 ? `<small>×${state.vouchers}</small>` : `<small>${YEN(VOUCHER_VALUE)}</small>`}</button>
              <button data-other class="cashcol__other">その他</button>
            </div>
            <div class="cashcol__row">
              <button data-clear class="cashcol__clear" ${received === null && state.vouchers === 0 ? 'disabled' : ''}>クリア</button>
              <div class="voucher-mini ${state.vouchers > 0 ? 'is-on' : ''}">
                <span>商品券</span>
                <strong>${state.vouchers > 0 ? `−${YEN(voucherAmount)}` : '—'}</strong>
              </div>
            </div>
          </div>
          <div class="cashinfo">
            <div class="pay__due">
              <span>現金でもらう</span>
              <strong>${total > 0 ? YEN(cashDue) : '—'}</strong>
            </div>
            <div class="pay__recv ${received === null ? 'is-empty' : ''}">
              <span>預かり</span>
              <strong>${received === null ? '—' : YEN(received)}</strong>
            </div>
            <div class="pay__change ${received === null ? 'is-empty' : shortage > 0 ? 'is-short' : ''}">
              <span>${shortage > 0 ? '不足' : 'お釣り'}</span>
              <strong>${received === null ? '—' : YEN(shortage > 0 ? shortage : change)}</strong>
            </div>
          </div>
          <button class="pay__done pay__done--panel" data-done ${canComplete ? '' : 'disabled'}>支払い完了</button>
        </div>
      </div>
      ${state.keypadOpen ? keypadHtml() : ''}
    </div>
  `;

  el.querySelector('[data-go="top"]').addEventListener('click', () => go('top'));
  el.querySelector('[data-undo]').addEventListener('click', undoLast);
  el.querySelector('[data-go2]').addEventListener('click', () => go('history'));
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
  el.querySelector('[data-voucher]').addEventListener('click', () => {
    state.vouchers += 1;
    render();
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
