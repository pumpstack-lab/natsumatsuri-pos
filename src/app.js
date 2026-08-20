import { state, subscribe, render, loadAll } from './ui/state.js';
import { renderTop } from './ui/screen-top.js';
import { renderRegister } from './ui/screen-register.js';
import { renderHistory } from './ui/screen-history.js';
import { renderProducts } from './ui/screen-products.js';
import { renderExport } from './ui/screen-export.js';
import { renderMerged } from './ui/screen-merged.js';
import { pushAll } from './sync.js';

const root = document.getElementById('app');

const SCREENS = {
  top: renderTop,
  register: renderRegister,
  history: renderHistory,
  products: renderProducts,
  export: renderExport,
  merged: renderMerged,
};

function draw() {
  const fn = SCREENS[state.screen] ?? renderTop;
  root.innerHTML = '';
  root.appendChild(fn());
}

subscribe(draw);

async function boot() {
  await loadAll();
  render();
  // オンラインなら裏で同期（失敗しても無視・登録機能には影響しない）
  pushAll().catch(() => {});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
