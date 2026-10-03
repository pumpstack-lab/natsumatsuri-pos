// 診断記録は一番先に仕掛ける（起動中に止まった場合も残すため）
import { installDiag, diag } from './diag.js';
import { BUILD } from './version.js';
import { state, subscribe, render, loadAll } from './ui/state.js';
import { renderTop } from './ui/screen-top.js';
import { renderRegister } from './ui/screen-register.js';
import { renderHistory } from './ui/screen-history.js';
import { renderProducts } from './ui/screen-products.js';
import { renderExport } from './ui/screen-export.js';
import { renderMerged } from './ui/screen-merged.js';
import { renderDiag } from './ui/screen-diag.js';
import { pushAll } from './sync.js';

const root = document.getElementById('app');

const SCREENS = {
  top: renderTop,
  register: renderRegister,
  history: renderHistory,
  products: renderProducts,
  export: renderExport,
  merged: renderMerged,
  diag: renderDiag,
};

function draw() {
  const fn = SCREENS[state.screen] ?? renderTop;
  // 先に作ってから差し替える。作る途中で失敗した時に画面が真っ白にならないように
  let next;
  try {
    next = fn();
  } catch (e) {
    diag('エラー', `画面「${state.screen}」の描画: ${e && e.message}`);
    throw e;
  }
  root.innerHTML = '';
  root.appendChild(next);
}

subscribe(draw);

installDiag(BUILD);

async function boot() {
  try {
    await loadAll();
  } catch (e) {
    diag('エラー', `起動時の読み込み: ${e && e.name} ${e && e.message}`);
    root.innerHTML = '<div style="padding:24px;font-size:18px;line-height:1.6">読み込みに失敗しました。<br><button style="margin:12px 0;padding:12px 20px;font-size:18px;border:1px solid #29abd6;border-radius:10px;color:#29abd6" onclick="location.reload()">もう一度読み込む</button><br><small>直らない時はアプリを閉じて開き直してください。売上は通常、端末に残っています。</small></div>';
    return;
  }
  render();
  // オンラインなら裏で同期（失敗しても無視・登録機能には影響しない）
  pushAll().catch(() => {});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
