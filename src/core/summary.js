import { eventById } from './events.js';

// 「この端末の売上を全消去」の対象を決める。
// ⚠️ 2026-09-28 ネイト指摘: 元の実装は端末内の全売上を消しており、
// マルシェのテスト売上を消すつもりで**9/19の祭りの記録まで消える**状態だった。
// 選んでいるイベントの分だけを対象にし、他イベントに何件残るかも返して
// confirm で知らせる（消えないことを明示するため）。
export function salesToClear(sales, terminal) {
  if (!terminal) return { target: [], otherCount: sales.length, otherLabels: [] };
  const target = sales.filter((s) => s.terminal === terminal);
  const others = sales.filter((s) => s.terminal !== terminal);
  const labels = [];
  for (const s of others) {
    const e = eventById(s.terminal);
    const name = e ? e.name : s.terminal;
    if (!labels.includes(name)) labels.push(name);
  }
  return { target, otherCount: others.length, otherLabels: labels };
}

function activeOnly(sales) {
  return sales.filter((s) => s.status === 'active');
}

export function summarize(sales) {
  const active = activeOnly(sales);
  const totalSales = active.reduce((sum, s) => sum + s.total, 0);
  const count = active.length;
  const average = count === 0 ? 0 : Math.round(totalSales / count);
  const voucherCount = active.reduce((sum, s) => sum + (s.vouchers ?? 0), 0);
  const paypayTotal = active.filter((s) => s.payment === 'paypay').reduce((sum, s) => sum + s.total, 0);
  const unpaidTotal = active.filter((s) => s.payment === 'unpaid').reduce((sum, s) => sum + s.total, 0);
  return { totalSales, count, average, voucherCount, paypayTotal, unpaidTotal };
}

export function productBreakdown(sales) {
  const map = new Map();
  for (const sale of activeOnly(sales)) {
    for (const item of sale.items) {
      const key = item.name;
      const cur = map.get(key) ?? { name: key, qty: 0, amount: 0 };
      cur.qty += item.qty;
      cur.amount += item.unit_price * item.qty;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
