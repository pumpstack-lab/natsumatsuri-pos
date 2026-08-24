export const BOM = '﻿';

const TERMINAL_LABEL = { food: 'フード', drink: 'ドリンク' };
const STATUS_LABEL = { active: '有効', voided: '取消' };
const PAYMENT_LABEL = { cash: '現金', paypay: 'PayPay', unpaid: '未納' };

function escapeCell(value) {
  let s = value === null || value === undefined ? '' : String(value);

  // Excelは = + - @ で始まるセルを数式として解釈する。
  // 「=お得セット」のような商品名を付けただけで表が壊れるので、先頭に ' を付けて無効化する。
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }

  // CR単体もExcelでは改行として扱われるため、引用符で囲む対象に含める。
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(cells) {
  return cells.map(escapeCell).join(',');
}

function localTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function detailCsv(sales) {
  const header = toRow([
    '会計ID', '顧客番号', '窓口', '商品名', '単価', '個数', '小計',
    '会計合計', '預かり', 'お釣り', '状態', '登録時刻', '商品券', '支払い', '職員名',
  ]);
  const rows = [];
  for (const s of sales) {
    for (const item of s.items) {
      rows.push(toRow([
        s.id, s.seq, TERMINAL_LABEL[s.terminal] ?? s.terminal,
        item.name, item.unit_price, item.qty, item.unit_price * item.qty,
        s.total, s.received, s.change,
        STATUS_LABEL[s.status] ?? s.status, localTime(s.created_at),
        (s.vouchers ?? 0) > 0 ? s.vouchers : '',
        PAYMENT_LABEL[s.payment ?? 'cash'],
        s.staffName ?? '',
      ]));
    }
  }
  return [header, ...rows].join('\n') + '\n';
}

export function summaryCsv(sales) {
  const header = toRow([
    '顧客番号', '窓口', '商品内訳', '合計', '預かり', 'お釣り', '状態', '登録時刻', '商品券', '支払い', '職員名',
  ]);
  const rows = sales.map((s) => toRow([
    s.seq, TERMINAL_LABEL[s.terminal] ?? s.terminal,
    s.items.map((i) => `${i.name}×${i.qty}`).join(' '),
    s.total, s.received, s.change,
    STATUS_LABEL[s.status] ?? s.status, localTime(s.created_at),
    (s.vouchers ?? 0) > 0 ? s.vouchers : '',
    PAYMENT_LABEL[s.payment ?? 'cash'],
    s.staffName ?? '',
  ]));
  return [header, ...rows].join('\n') + '\n';
}

export function csvFileName(terminal, kind, date) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `komoreji_${terminal}_${kind}_${stamp}.csv`;
}
