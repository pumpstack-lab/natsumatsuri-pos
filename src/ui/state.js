import { getAllProducts, putProducts, getMeta, setMeta, getAllSales } from '../db.js';
import { DEFAULT_PRODUCTS, PRODUCTS_SEED_VERSION, mergeDefaultProducts } from '../core/products.js';
import { emptyCashTaps } from '../core/cash.js';

export const state = {
  screen: 'top',
  terminal: null,
  cart: [],
  cashTaps: emptyCashTaps(),
  otherAmount: 0,
  vouchers: 0,
  products: [],
  sales: [],
  historyTab: 'list',
  editingSaleId: null,
  keypadOpen: false,
  category: null,          // 選択中のカテゴリー（null = すべて）。端末には保存しない
};

const listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
}

export function render() {
  listeners.forEach((fn) => fn());
}

export async function loadAll() {
  let products = await getAllProducts();
  const seed = await getMeta('products_seed', null);
  if (seed !== PRODUCTS_SEED_VERSION) {
    products = mergeDefaultProducts(products, DEFAULT_PRODUCTS);
    await putProducts(products);
    await setMeta('products_seed', PRODUCTS_SEED_VERSION);
  }
  state.products = products;
  state.sales = await getAllSales();
  state.terminal = await getMeta('terminal', null);
}

export async function setTerminal(terminal) {
  state.terminal = terminal;
  await setMeta('terminal', terminal);
}

export function resetCart() {
  state.cart = [];
  state.cashTaps = emptyCashTaps();
  state.otherAmount = 0;
  state.vouchers = 0;
  state.keypadOpen = false;
  state.category = null;   // 会計が終わったら先頭タブ（すべて）に戻す（オーナー確定2026-09-25）
}

export function nextSeq(terminal) {
  const mine = state.sales.filter((s) => s.terminal === terminal);
  return mine.length === 0 ? 1 : Math.max(...mine.map((s) => s.seq)) + 1;
}

export function go(screen) {
  state.screen = screen;
  render();
}
