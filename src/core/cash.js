// 預かり金ボタンの金種（計算・初期化・リセットの正）。
// ⚠️ 画面のボタン自体は screen-register.js と screen-history.js に手書きされている。
//    金種を増減する場合はこの配列と、その2ファイルのボタンHTMLを両方直すこと。
export const CASH_UNITS = [100, 1000, 5000, 10000];

export function emptyCashTaps() {
  const taps = {};
  for (const unit of CASH_UNITS) taps[unit] = 0;
  return taps;
}

export function tapsTotal(taps) {
  return CASH_UNITS.reduce((sum, unit) => sum + unit * (taps[unit] ?? 0), 0);
}

// 商品券の額面（仮）。実額が決まったらここだけ直す。
export const VOUCHER_VALUE = 100;
