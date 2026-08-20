import { state, go, render } from './state.js';
import { esc } from './escape.js';
import { summarize, productBreakdown } from '../core/summary.js';
import { pushAll, fetchAll, getSyncKey, setSyncKey } from '../sync.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

// 画面ローカルの状態（表示のたびに再取得する）
let merged = null;       // 取得済みの全端末データ
let loading = false;
let error = null;
let keyMissing = false;

async function load() {
  loading = true; error = null;
  render();
  try {
    const key = await getSyncKey();
    if (!key) { keyMissing = true; loading = false; render(); return; }
    keyMissing = false;
    if (!navigator.onLine) throw new Error('OFFLINE');
    await pushAll();               // まず自分の端末分を送る
    merged = await fetchAll();     // 全端末分を取得
  } catch (e) {
    error = e.message === 'OFFLINE'
      ? 'オフラインです。Wi-Fiに接続してから開いてください。'
      : '取得できませんでした。Wi-Fi接続と同期キーを確認してください。';
  }
  loading = false;
  render();
}

export function openMerged() {
  merged = null; error = null; keyMissing = false;
  go('merged');
  load();
}

function hhmm(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function renderMerged() {
  const el = document.createElement('div');
  el.className = 'screen';

  let body = '';
  if (keyMissing) {
    body = `
      <div class="pad">
        <div class="card">
          <h2>同期キーが未設定です</h2>
          <p style="font-size:13px;color:var(--gray);line-height:1.7;margin-bottom:10px">
            合算履歴を使うには、この端末に一度だけ同期キーを保存します。<br>
            Getterから渡されたキー（sb_publishable_... で始まる文字列）を貼り付けてください。
          </p>
          <input class="field" data-key-input type="text" placeholder="sb_publishable_...">
          <button class="btn-primary" data-key-save>保存して読み込む</button>
        </div>
      </div>`;
  } else if (loading) {
    body = '<div class="cart__empty" style="padding:40px">読み込み中…</div>';
  } else if (error) {
    body = `<div class="pad"><div class="card"><h2>読み込めませんでした</h2>
      <p style="font-size:13px;color:var(--gray);line-height:1.7">${esc(error)}</p>
      <button class="btn-ghost" data-retry>再読み込み</button></div></div>`;
  } else if (merged) {
    const all = summarize(merged);
    const food = summarize(merged.filter((s) => s.terminal === 'food'));
    const drink = summarize(merged.filter((s) => s.terminal === 'drink'));
    const breakdown = productBreakdown(merged);
    body = `
      <div class="kpi">
        <div class="kpi__box kpi__box--main">
          <div class="kpi__label">総売上（2窓口合算）</div>
          <div class="kpi__value">${YEN(all.totalSales)}</div>
        </div>
        <div class="kpi__box"><div class="kpi__label">🍔 フード</div><div class="kpi__value">${YEN(food.totalSales)}</div></div>
        <div class="kpi__box"><div class="kpi__label">🥤 ドリンク</div><div class="kpi__value">${YEN(drink.totalSales)}</div></div>
        <div class="kpi__box"><div class="kpi__label">会計数</div><div class="kpi__value">${all.count}</div></div>
        <div class="kpi__box"><div class="kpi__label">PayPay</div><div class="kpi__value">${YEN(all.paypayTotal)}</div></div>
        <div class="kpi__box"><div class="kpi__label">商品券</div><div class="kpi__value">${all.voucherCount}<span style="font-size:12px;color:var(--gray)">枚</span></div></div>
      </div>
      <div class="scroll">
        <div class="pad">
          ${all.unpaidTotal > 0 ? `<div class="sheet__warn" style="margin-bottom:10px">未納が ${YEN(all.unpaidTotal)} あります（職員販売・回収前）</div>` : ''}
          <div class="card">
            <h2>商品別（2窓口合算）</h2>
            ${breakdown.map((p) => `
              <div class="pbreak__row"><span>${esc(p.name)}</span><span><strong>${p.qty}</strong> / ${YEN(p.amount)}</span></div>
            `).join('') || '<div class="cart__empty">まだデータがありません</div>'}
          </div>
          <div class="card">
            <h2>最近の会計（全端末・最新30件）</h2>
            ${merged.slice(0, 30).map((s) => `
              <div class="pbreak__row">
                <span>${s.terminal === 'food' ? '🍔' : '🥤'} 顧客${s.seq}${s.staffName ? ` 👤${esc(s.staffName)}` : ''}${s.status === 'voided' ? ' <span style="color:var(--red)">取消</span>' : ''}</span>
                <span><strong>${YEN(s.total)}</strong> <span style="color:var(--gray);font-size:12px">${hhmm(s.created_at)}</span></span>
              </div>
            `).join('')}
          </div>
          <p style="font-size:12px;color:var(--gray);line-height:1.6">
            この画面はWi-Fi接続時のみ使えます。各iPadの売上は開いた時点で自動送信されます。<br>
            屋台での登録はこの機能と無関係に、オフラインで動き続けます。
          </p>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">🌐 合算履歴（オンライン）</span>
      <button class="bar__btn" data-reload>🔄 更新</button>
    </div>
    ${body}
  `;

  el.querySelector('[data-go="top"]').addEventListener('click', () => go('top'));
  el.querySelector('[data-reload]').addEventListener('click', load);
  const keySave = el.querySelector('[data-key-save]');
  if (keySave) keySave.addEventListener('click', async () => {
    const v = el.querySelector('[data-key-input]').value.trim();
    if (!v) { alert('キーを貼り付けてください。'); return; }
    await setSyncKey(v);
    load();
  });
  const retry = el.querySelector('[data-retry]');
  if (retry) retry.addEventListener('click', load);

  return el;
}
