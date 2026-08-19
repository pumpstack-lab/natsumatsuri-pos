import { state, go, setTerminal, resetCart, render } from './state.js';
import { summarize } from '../core/summary.js';
import { BUILD } from '../version.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function terminalStats(terminal) {
  const sales = state.sales.filter((s) => s.terminal === terminal);
  return summarize(sales);
}

async function pick(terminal) {
  if (state.terminal && state.terminal !== terminal) {
    const label = terminal === 'food' ? 'フード' : 'ドリンク';
    const ok = confirm(`この端末を「${label}窓口」に切り替えます。よろしいですか？\n\n（登録済みの売上は消えません）`);
    if (!ok) return;
  }
  await setTerminal(terminal);
  resetCart();
  go('register');
}

export function renderTop() {
  const el = document.createElement('div');
  el.className = 'screen';

  const food = terminalStats('food');
  const drink = terminalStats('drink');
  const mine = state.terminal ? terminalStats(state.terminal) : { totalSales: 0 };

  el.innerHTML = `
    <div class="top">
      <div class="top__lead">
        <h1>どちらの窓口ですか？</h1>
        <p>選ぶとこの端末に記憶されます</p>
      </div>
      <div class="top__pick">
        <button class="pick pick--food" data-pick="food">
          <span class="pick__icon">🍔</span>
          <span class="pick__name">フード</span>
          <span class="pick__meta">${food.count === 0 ? '未使用' : `${food.count}組 / ${YEN(food.totalSales)}`}</span>
        </button>
        <button class="pick pick--drink" data-pick="drink">
          <span class="pick__icon">🥤</span>
          <span class="pick__name">ドリンク</span>
          <span class="pick__meta">${drink.count === 0 ? '未使用' : `${drink.count}組 / ${YEN(drink.totalSales)}`}</span>
        </button>
      </div>
      <div class="top__menu">
        <button data-go="history">📋 履歴・集計</button>
        <button data-go="products">🍳 商品の設定</button>
        <button data-go="export">📤 CSV書き出し</button>
      </div>
      <div class="top__ver">ver ${BUILD}</div>
      <div class="top__total">
        <span>${state.terminal === 'drink' ? 'ドリンク窓口' : state.terminal === 'food' ? 'フード窓口' : 'この端末'}の売上</span>
        <strong>${YEN(mine.totalSales)}</strong>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => pick(btn.dataset.pick));
  });
  el.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.terminal && btn.dataset.go !== 'products') {
        alert('先にフードかドリンクを選んでください。');
        return;
      }
      go(btn.dataset.go);
    });
  });

  return el;
}
