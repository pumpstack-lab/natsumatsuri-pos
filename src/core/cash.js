// 預かり金ボタンの金種。窓口ごとに異なる（2026-08-20 オーナー確定:
// ドリンクは¥10,000を廃止し¥50を新設。フードは従来通り）。
export const CASH_UNITS_BY_TERMINAL = {
  food: [100, 1000, 5000, 10000],
  drink: [50, 100, 1000, 5000],
};

// 全窓口の金種の和集合。tapsの初期化と合計はこちらを使う
// （窓口を切り替えてもキーが欠落しないように）。
export const ALL_CASH_UNITS = [50, 100, 1000, 5000, 10000];

export function CASH_UNITS_FOR(terminal) {
  return CASH_UNITS_BY_TERMINAL[terminal] ?? CASH_UNITS_BY_TERMINAL.food;
}

// 互換用（既存テスト・既存コードが参照）
export const CASH_UNITS = ALL_CASH_UNITS;

export function emptyCashTaps() {
  const taps = {};
  for (const unit of ALL_CASH_UNITS) taps[unit] = 0;
  return taps;
}

export function tapsTotal(taps) {
  return ALL_CASH_UNITS.reduce((sum, unit) => sum + unit * (taps[unit] ?? 0), 0);
}

// 商品券の額面（仮）。実額が決まったらここだけ直す。
export const VOUCHER_VALUE = 100;
