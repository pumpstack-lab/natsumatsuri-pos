// 診断記録（2026-10-03 現場「途中でボタンが何も反応しなくなり、閉じて開いたら戻った」の調査用）。
// 押したボタン・エラー・保存の開始/終了・入力窓の開閉・裏に回った/戻った を時刻付きで残す。
// 保存先は localStorage。会計の保存先（IndexedDB）が止まった時にも記録できるよう、あえて分けている。
// ⚠️ ここで例外を出すとレジ自体が止まるので、全ての処理を try/catch で包む。
import { appendEntry } from './core/diaglog.js';

const KEY = 'komoreji_diag';
const HEARTBEAT_MS = 2000;
// 画面が表示中なのに、この時間以上 心拍が途切れたら「画面の処理が止まっていた」と記録する
const GAP_MS = 6000;

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    cache = [];
  }
  return cache;
}

export function diag(kind, detail = '') {
  try {
    cache = appendEntry(load(), { t: new Date().toISOString(), k: kind, d: String(detail).slice(0, 160) });
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 容量不足・プライベートモード等。記録できなくてもレジは止めない
  }
}

export function readDiag() {
  return [...load()];
}

export function clearDiag() {
  cache = [];
  try { localStorage.removeItem(KEY); } catch { /* 無視 */ }
}

// 押した物を短く言い表す（例: 「支払い完了 [data-done]」）
function describe(target) {
  const el = target && target.closest ? target.closest('button, input, select, a, [data-add]') : null;
  if (!el) return target && target.tagName ? `(${target.tagName.toLowerCase()})` : '(不明)';
  const data = Object.keys(el.dataset || {}).map((k) => `${k}=${el.dataset[k]}`).join(' ');
  const text = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return `${text}${data ? ` [${data}]` : ''}${el.disabled ? ' (押せない状態)' : ''}`;
}

// 標準の入力窓（prompt/confirm/alert）は開いている間 画面全体を止める。
// ホーム画面から起動したアプリで窓が見えなくなっていないかを、開いた/閉じたの対で確かめる。
function wrapDialog(name) {
  const orig = window[name];
  if (typeof orig !== 'function') return;
  window[name] = function (...args) {
    const msg = String(args[0] ?? '').split('\n')[0].slice(0, 40);
    diag(`${name}:開`, msg);
    const started = Date.now();
    const result = orig.apply(window, args);
    diag(`${name}:閉`, `${Date.now() - started}ms 結果=${result === null ? 'キャンセル' : result === undefined ? '-' : String(result).slice(0, 20)}`);
    return result;
  };
}

export function installDiag(build) {
  try {
    const standalone = window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    diag('起動', `ver ${build} / ${standalone ? 'ホーム画面' : 'ブラウザ'} / ${navigator.userAgent.slice(0, 110)}`);

    document.addEventListener('click', (e) => diag('押した', describe(e.target)), true);
    // click が来ない（押しても反応しない）時でも、指が触れたことは pointerdown で残る
    document.addEventListener('pointerdown', (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      diag('触れた', `${Math.round(e.clientX)},${Math.round(e.clientY)} ${describe(el)}`);
    }, true);
    window.addEventListener('error', (e) => diag('エラー', `${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
    window.addEventListener('unhandledrejection', (e) => diag('エラー(非同期)', e.reason && (e.reason.stack || e.reason.message) || String(e.reason)));
    document.addEventListener('visibilitychange', () => diag(document.hidden ? '裏に回った' : '表に戻った'));
    window.addEventListener('pagehide', (e) => diag('ページ終了', e.persisted ? '保留' : ''));
    window.addEventListener('pageshow', (e) => { if (e.persisted) diag('ページ復帰'); });

    ['alert', 'confirm', 'prompt'].forEach(wrapDialog);

    let last = Date.now();
    setInterval(() => {
      const now = Date.now();
      if (!document.hidden && now - last > GAP_MS) diag('処理が止まっていた', `${Math.round((now - last) / 1000)}秒`);
      last = now;
    }, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', () => { last = Date.now(); });
  } catch {
    // 記録の仕組みが壊れてもレジは動かす
  }
}
