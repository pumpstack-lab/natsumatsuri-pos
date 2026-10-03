import { cartTotal, calcChange } from './money.js';
import { VOUCHER_VALUE } from './cash.js';

let idCounter = 0;

function copyItems(items) {
  return items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    unit_price: item.unit_price,
    qty: item.qty,
    category: item.category ?? '',
  }));
}

export function createSale({ terminal, seq, items, received, now, vouchers = 0, staffName = null, payment = 'cash' }) {
  const copiedItems = copyItems(items);
  const total = cartTotal(copiedItems);
  const { change } = calcChange(total, received, vouchers * VOUCHER_VALUE);
  idCounter += 1;

  return {
    id: `${terminal}-${now}-${seq}-${idCounter}`,
    terminal,
    seq,
    items: copiedItems,
    total,
    received: received ?? null,
    change: received === null || received === undefined ? null : change,
    vouchers,
    staffName,
    payment,
    status: 'active',
    edited: false,
    created_at: now,
    updated_at: now,
  };
}

// options.received を渡すと預かり金も変更できる（履歴画面の修正で使う）。
// 省略した場合は元の預かり金を引き継ぐ。
export function editSaleItems(sale, newItems, now, options = {}) {
  const copiedItems = copyItems(newItems);
  const total = cartTotal(copiedItems);

  const nextReceived = 'received' in options ? options.received : sale.received;
  const nextVouchers = 'vouchers' in options ? options.vouchers : (sale.vouchers ?? 0);
  const nextPayment = 'payment' in options ? options.payment : (sale.payment ?? 'cash');
  const { change, shortage } = calcChange(total, nextReceived, nextVouchers * VOUCHER_VALUE);

  // 預かり金が合計に足りない場合、その額は現実と食い違っている。
  // お釣り0円という嘘を残すより「不明」として記録から外す（売上金額は正しく再計算される）。
  const keepReceived = nextReceived !== null && nextReceived !== undefined && shortage === 0;

  return {
    ...sale,
    items: copiedItems,
    total,
    received: keepReceived ? nextReceived : null,
    change: keepReceived ? change : null,
    vouchers: nextVouchers,
    payment: nextPayment,
    edited: true,
    updated_at: now,
  };
}

export function voidSale(sale, now) {
  return { ...sale, status: 'voided', updated_at: now };
}

// 保存に失敗した会計を「もう一度押す」で再送する時の同一判定キー。
// 保存が時間切れになっても、裏で書き込みが遅れて成功していることがある。
// 再送で新しい会計を作ると二重登録になるため、伝票が同じなら同じ会計（同じid）を使い回す。
export function saleRetryKey({ terminal, items, received, vouchers, payment, staffName }) {
  return JSON.stringify({
    terminal,
    items: items.map((i) => [i.product_id, i.unit_price, i.qty]),
    received: received ?? null,
    vouchers: vouchers ?? 0,
    payment: payment ?? 'cash',
    staffName: staffName ?? null,
  });
}
