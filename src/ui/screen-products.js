import { esc } from './escape.js';
import { parsePriceInput } from '../core/money.js';
import { state, go, render } from './state.js';
import { reorderProducts } from '../core/products.js';
import { putProducts } from '../db.js';
import { eventLabel } from '../core/events.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function listFor(terminal) {
  return state.products
    .filter((p) => p.terminal === terminal)
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function persist() {
  try {
    await putProducts(state.products);
  } catch (e) {
    alert('商品の変更を保存できませんでした。もう一度お試しください。');
  }
  render();
}

async function toggle(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  p.is_available = !p.is_available;
  await persist();
}

async function edit(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const name = prompt('商品名', p.name);
  if (name === null) return;
  const category = prompt('分類（マルシェのカテゴリー。空欄なら分類なし）', p.category ?? '');
  if (category === null) return;
  const priceStr = prompt('価格（円・整数）', String(p.price));
  if (priceStr === null) return;
  // 全角数字「４８０」もカンマ付き「1,500」も受ける。
  // parseInt だと "1,500" が 1 になり ¥1 で売ってしまう（2026-10-01 発見）
  const price = parsePriceInput(priceStr);
  if (price === null) {
    alert('価格は1以上の数字で入力してください。\n（全角や「1,500」のようなカンマ付きでも入力できます）');
    return;
  }
  // 「シュシュ 450円」のように名前に金額が入った商品は、価格だけ直すと
  // ボタンの表示が古い金額のまま残る（末尾が「円」だと価格行も出ないので気付けない）。
  // 名前を触っていない時だけ、名前の中の金額も新しい価格に合わせる（2026-10-01 ネイト指摘）。
  let newName = name.trim() || p.name;
  if (newName === p.name && price !== p.price && /\d\s*円$/.test(newName)) {
    newName = newName.replace(/[\d,]+\s*円$/, `${price.toLocaleString('ja-JP')}円`);
  }
  p.name = newName;
  p.price = price;
  p.category = category.trim();
  await persist();
}

async function add(terminal) {
  const name = prompt('商品名');
  if (name === null) return;          // キャンセル
  if (!name.trim()) return;
  const category = prompt('分類（マルシェのカテゴリー。空欄なら分類なし）', '');
  if (category === null) return;
  const priceStr = prompt('価格（円・整数）');
  if (priceStr === null) return;      // キャンセル（入力ミスとは区別する）
  // 全角数字「４８０」もカンマ付き「1,500」も受ける。
  // parseInt だと "1,500" が 1 になり ¥1 で売ってしまう（2026-10-01 発見）
  const price = parsePriceInput(priceStr);
  if (price === null) {
    alert('価格は1以上の数字で入力してください。\n（全角や「1,500」のようなカンマ付きでも入力できます）');
    return;
  }
  const list = listFor(terminal);
  // 並び順は既存の最大値+1にする。list.length だと並べ替え後に既存商品と衝突して
  // 新商品が末尾ではなく途中に紛れ込む。
  const nextOrder = list.length === 0 ? 0 : Math.max(...list.map((p) => p.sort_order)) + 1;
  state.products.push({
    id: `${terminal[0]}${Date.now()}`,
    terminal,
    name: name.trim(),
    price,
    sort_order: nextOrder,
    category: category.trim(),
    is_available: true,
  });
  await persist();
}

async function move(id, dir) {
  const target = state.products.find((x) => x.id === id);
  if (!target) return;
  const terminal = target.terminal;
  const list = listFor(terminal);
  const idx = list.findIndex((p) => p.id === id);
  const swap = idx + dir;
  if (swap < 0 || swap >= list.length) return;
  const ids = list.map((p) => p.id);
  [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
  state.products = reorderProducts(state.products, ids);
  await persist();
}

export function renderProducts() {
  const el = document.createElement('div');
  el.className = 'screen';
  const terminal = state.terminal ?? 'food';
  const label = eventLabel(terminal);
  const list = listFor(terminal);

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">${label}の商品</span>
      <button class="bar__btn" data-add>＋ 追加</button>
    </div>
    <div class="scroll">
      <div class="plist">
        ${list.map((p, i) => `
          <div class="prow">
            <span>
              <span class="prow__name">${esc(p.name)}</span>
              <span class="prow__price">${YEN(p.price)}</span>
            </span>
            <span class="prow__ctl">
              <button data-up="${esc(p.id)}" ${i === 0 ? 'style="opacity:.3"' : ''}>↑</button>
              <button data-down="${esc(p.id)}" ${i === list.length - 1 ? 'style="opacity:.3"' : ''}>↓</button>
              <button data-edit="${esc(p.id)}">編集</button>
              <span class="switch ${p.is_available ? '' : 'is-off'}" data-toggle="${esc(p.id)}"></span>
            </span>
          </div>
        `).join('')}
      </div>
      <div class="pad">
        <div class="card" style="font-size:13px;color:var(--gray);line-height:1.6">
          売り切れた商品はスイッチをオフにすると登録画面から消えます。<br>
          <strong style="color:var(--ink)">登録済みの売上には影響しません。</strong>
        </div>
      </div>
    </div>
  `;

  el.querySelector('[data-go]').addEventListener('click', () => go('top'));
  el.querySelector('[data-add]').addEventListener('click', () => add(terminal));
  el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.toggle)));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(b.dataset.edit)));
  el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(b.dataset.up, -1)));
  el.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => move(b.dataset.down, 1)));

  return el;
}
