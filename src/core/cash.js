// 預かり金ボタンの金種。ここが唯一の定義。
// 追加・変更する場合はこの配列だけを直せば、画面・初期化・リセットの全てに反映される。
export const CASH_UNITS = [100, 1000, 5000, 10000];

export function emptyCashTaps() {
  const taps = {};
  for (const unit of CASH_UNITS) taps[unit] = 0;
  return taps;
}

export function tapsTotal(taps) {
  return CASH_UNITS.reduce((sum, unit) => sum + unit * (taps[unit] ?? 0), 0);
}
