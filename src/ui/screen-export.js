import { state, go } from './state.js';
import { summarize } from '../core/summary.js';
import { buildXlsx } from '../core/xlsx.js';
import { detailSheet, summarySheet, xlsxFileName } from '../core/exportsheets.js';

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
  const voided = sales.filter((s) => s.status === 'voided').length;
  const label = state.terminal === 'food' ? 'フード窓口' : 'ドリンク窓口';

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

        <button class="btn-primary" data-xlsx>Excelで書き出す（.xlsx）</button>
        <p style="font-size:12px;color:var(--gray);margin-top:8px;line-height:1.6">
          1ファイルに「明細」「サマリー」の2シートが入ります。文字化けはしません。
        </p>

        <div class="card" style="margin-top:12px;font-size:13px;color:var(--gray);line-height:1.7">
          <strong style="color:var(--ink)">PCでの合算手順</strong><br>
          1. 2台それぞれでExcelを書き出してPCへ送る<br>
          2. 各ファイルの「明細」シートを、合算テンプレートの「貼り付け」シートにコピー<br>
          3. 「集計結果」シートに総売上・PayPay・未納・商品券が自動で出ます
        </div>
      </div>
    </div>
  `;

  el.querySelector('[data-go]').addEventListener('click', () => go('top'));
  el.querySelector('[data-xlsx]').addEventListener('click', () => {
    if (sales.length === 0) { alert('書き出す会計がありません。'); return; }
    const bytes = buildXlsx([detailSheet(sales), summarySheet(sales)]);
    download(bytes, xlsxFileName(state.terminal, new Date()));
  });

  return el;
}
