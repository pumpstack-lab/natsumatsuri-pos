import { getAllProducts, putProducts, getMeta, setMeta, getAllSales } from '../db.js';
import { DEFAULT_PRODUCTS } from '../core/products.js';
import { emptyCashTaps } from '../core/cash.js';

export const state = {
  screen: 'top',
  terminal: null,
  cart: [],
  received: null,
  cashTaps: emptyCashTaps(),
  otherAmount: 0,
  vouchers: 0,
  products: [],
  sales: [],
  historyTab: 'list',
  editingSaleId: null,
  keypadOpen: false,
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
  if (products.length === 0) {
    await putProducts(DEFAULT_PRODUCTS);
    products = DEFAULT_PRODUCTS.slice();
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
  state.received = null;
  state.cashTaps = emptyCashTaps();
  state.otherAmount = 0;
  state.vouchers = 0;
  state.keypadOpen = false;
}

export function nextSeq(terminal) {
  const mine = state.sales.filter((s) => s.terminal === terminal);
  return mine.length === 0 ? 1 : Math.max(...mine.map((s) => s.seq)) + 1;
}

export function go(screen) {
  state.screen = screen;
  render();
}
