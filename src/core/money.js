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

// 現場で価格を入力した時の文字列を価格に直す。
// iPadの日本語キーボードだと全角数字「４８０」が入り、
// ボタンの表示が「1,500円」なのでカンマ付き「1,500」も入る。
// parseInt は "1,500" を 1 と読むため、**¥1,500 の商品を ¥1 で売ってしまう**。
// 無効な入力は null を返し、呼び出し側で弾く（勝手に解釈しない）。
// 2026-10-01 本番前の総当たり検証で発見。
export function parsePriceInput(input) {
  if (input === null || input === undefined) return null;
  const normalized = String(input)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))  // 全角→半角
    .replace(/[,，\s]/g, '')                                                     // カンマ・空白を取る
    .replace(/[¥￥円]/g, '');                                                    // 通貨記号も許す
  if (!/^\d+$/.test(normalized)) return null;   // 数字以外が残ったら無効
  const price = parseInt(normalized, 10);
  if (!Number.isInteger(price) || price <= 0) return null;
  return price;
}
