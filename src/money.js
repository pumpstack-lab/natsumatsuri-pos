export function lineSubtotal(unitPrice, qty) {
  return unitPrice * qty;
}

export function cartTotal(items) {
  return items.reduce((sum, item) => sum + lineSubtotal(item.unit_price, item.qty), 0);
}

// total: 会計合計 / received: 現金の預かり額(null=未入力) / voucherAmount: 商品券の合計額
// cashDue = 商品券を引いた後に「現金でもらう額」。商品券が合計を超えてもお釣りは出さない。
export function calcChange(total, received, voucherAmount = 0) {
  const cashDue = Math.max(0, total - voucherAmount);

  if (total <= 0) {
    // 空の伝票。完了はできないが、預かり金の入力自体は受け付ける
    // （表示用にchangeへ数値を返す。nullを返すと画面の金額表示が落ちる）。
    return { change: received ?? 0, shortage: 0, canComplete: false, cashDue: 0 };
  }
  if (received === null || received === undefined) {
    // 預かり未入力＝残額ちょうど受領として完了できる
    return { change: null, shortage: 0, canComplete: true, cashDue };
  }
  if (received < cashDue) {
    return { change: 0, shortage: cashDue - received, canComplete: false, cashDue };
  }
  return { change: received - cashDue, shortage: 0, canComplete: true, cashDue };
}
