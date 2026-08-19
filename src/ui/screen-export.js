import { state, go } from './state.js';
import { summarize } from '../core/summary.js';
import { detailCsv, summaryCsv, csvFileName, BOM } from '../core/csv.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function mySales() {
  return state.sales.filter((s) => s.terminal === state.terminal);
}

function download(text, filename) {
  const blob = new Blob([BOM + text], { type: 'text/csv;charset=utf-8;' });
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
  const voided = sales.filter((s) => s.status === 'voided').length;
  const label = state.terminal === 'food' ? 'フード窓口' : 'ドリンク窓口';

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-go="top">‹ トップ</button>
      <span class="bar__title">CSV書き出し</span>
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
            商品券の使用：<strong style="color:var(--ink)">${sum.voucherCount}枚</strong>（換金用・CSVの商品券列に枚数が出ます）<br>
            取消した会計：${voided}件（CSVには「取消」として出力されます）<br>
            全レコード：${sales.length}件
          </div>
        </div>

        <button class="btn-primary" data-detail>明細CSVを書き出す</button>
        <button class="btn-ghost" data-summary>サマリーCSVを書き出す</button>

        <div class="card" style="margin-top:12px;font-size:13px;color:var(--gray);line-height:1.7">
          <strong style="color:var(--ink)">PCでの合算手順</strong><br>
          1. 2台それぞれで明細CSVを書き出す<br>
          2. PCのExcelで2つを開き1つのシートに結合<br>
          3. 状態が「取消」の行を除外して小計を合計 → 総売上<br>
          4. 商品名でピボット → 商品別集計
        </div>
      </div>
    </div>
  `;

  el.querySelector('[data-go]').addEventListener('click', () => go('top'));
  el.querySelector('[data-detail]').addEventListener('click', () => {
    if (sales.length === 0) { alert('書き出す会計がありません。'); return; }
    download(detailCsv(sales), csvFileName(state.terminal, 'detail', new Date()));
  });
  el.querySelector('[data-summary]').addEventListener('click', () => {
    if (sales.length === 0) { alert('書き出す会計がありません。'); return; }
    download(summaryCsv(sales), csvFileName(state.terminal, 'summary', new Date()));
  });

  return el;
}
