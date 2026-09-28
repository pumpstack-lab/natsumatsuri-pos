import { state, go, render, resetCart } from './state.js';
import { esc } from './escape.js';
import { eventLabel } from '../core/events.js';
import { summarize, productBreakdown } from '../core/summary.js';
import { buildXlsx } from '../core/xlsx.js';
import { detailSheet, summarySheet, productSheet, xlsxFileName } from '../core/exportsheets.js';
import { clearSales } from '../db.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function mySales() {
  return state.sales.filter((s) => s.terminal === state.terminal);
}

function download(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderExport() {
  const el = document.createElement('div');
  el.className = 'screen';
  const sales = mySales();
  const sum = summarize(sales);
  const breakdown = productBreakdown(sales);
  const topProducts = breakdown.slice(0, 5);
  const voided = sales.filter((s) => s.status === 'voided').length;
  const label = eventLabel(state.terminal);

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">Excel書き出し</span>
      <span style="width:60px"></span>
    </div>
    <div class="scroll">
      <div class="pad">
        <div class="kpi" style="border-radius:12px;overflow:hidden;margin-bottom:12px">
          <div class="kpi__box kpi__box--main">
            <div class="kpi__label">${label}の売上</div>
            <div class="kpi__value">${YEN(sum.totalSales)}</div>
          </div>
          <div class="kpi__box">
            <div class="kpi__label">会計数</div>
            <div class="kpi__value">${sum.count}</div>
          </div>
        </div>

        <div class="card">
          <h2>書き出す内容</h2>
          <div style="font-size:13px;color:var(--gray);line-height:1.8">
            有効な会計：<strong style="color:var(--ink)">${sum.count}件 / ${YEN(sum.totalSales)}</strong><br>
            商品券の使用：<strong style="color:var(--ink)">${sum.voucherCount}枚</strong>（換金用・商品券列に枚数が出ます）<br>
            PayPay支払い：<strong style="color:var(--ink)">${YEN(sum.paypayTotal)}</strong>／未納：<strong style="color:${sum.unpaidTotal > 0 ? 'var(--red)' : 'var(--ink)'}">${YEN(sum.unpaidTotal)}</strong><br>
            取消した会計：${voided}件（「取消」として出力・集計からは除外）<br>
            全レコード：${sales.length}件
          </div>
        </div>

        <div class="card">
          <h2>商品別の売上（「商品別」シートに出ます）</h2>
          ${topProducts.length === 0 ? `
            <div style="font-size:13px;color:var(--gray)">まだ会計がありません</div>
          ` : `
            <div style="font-size:13px;line-height:1.9">
              ${topProducts.map((p) => `
                <div style="display:flex;justify-content:space-between;gap:12px">
                  <span>${esc(p.name)}</span>
                  <span style="color:var(--gray)"><strong style="color:var(--ink)">${p.qty}</strong>個 / <strong style="color:var(--ink)">${YEN(p.amount)}</strong></span>
                </div>`).join('')}
              ${breakdown.length > topProducts.length ? `<div style="color:var(--gray);margin-top:4px">…ほか${breakdown.length - topProducts.length}品目（Excelに全部出ます）</div>` : ''}
            </div>
          `}
        </div>

        <button class="btn-primary" data-xlsx>Excelで書き出す（.xlsx）</button>
        <p style="font-size:12px;color:var(--gray);margin-top:8px;line-height:1.6">
          1ファイルに「明細」「サマリー」「商品別」の3シートが入ります。文字化けはしません。
        </p>

        <div class="card" style="margin-top:12px;font-size:13px;color:var(--gray);line-height:1.7">
          <strong style="color:var(--ink)">PCでの合算手順</strong><br>
          1. 2台それぞれでExcelを書き出してPCへ送る<br>
          2. 各ファイルの「明細」シートを、合算テンプレートの「貼り付け」シートにコピー<br>
          3. 「集計結果」シートに総売上・PayPay・未納・商品券が自動で出ます
        </div>

        <button class="btn-danger" data-clear-sales style="margin-top:24px"${state.sales.length === 0 ? ' disabled' : ''}>🧹 この端末の売上を全消去（祭り前リセット）</button>
      </div>
    </div>
  `;

  el.querySelector('[data-go]').addEventListener('click', () => go('top'));
  el.querySelector('[data-xlsx]').addEventListener('click', () => {
    if (sales.length === 0) { alert('書き出す会計がありません。'); return; }
    const bytes = buildXlsx([detailSheet(sales), summarySheet(sales), productSheet(sales)]);
    download(bytes, xlsxFileName(state.terminal, new Date()));
  });
  el.querySelector('[data-clear-sales]').addEventListener('click', async () => {
    const n = state.sales.length;
    if (n === 0) return;
    const ok = confirm(`この端末に記録された売上 ${n}件 をすべて消します。商品・価格・同期キーは消えません。\n\n⚠️ 元に戻せません。祭りが始まる前にだけ使ってください。`);
    if (!ok) return;
    const input = prompt('確認のため「削除」と入力してください');
    if (input !== '削除') { alert('キャンセルしました'); return; }
    await clearSales();
    state.sales = [];
    resetCart();
    render();
    alert(`売上 ${n}件を消去しました`);
  });

  return el;
}
