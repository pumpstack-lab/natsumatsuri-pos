// 預かり金ボタンの金種。窓口ごとに異なる（2026-08-20 オーナー確定:
// ドリンクは¥10,000を廃止し¥50を新設。フードは従来通り）。
// 2026-09-16 フードに¥50追加（フランクフルト¥450・エビフライ¥650でお釣りに¥50玉が出るため・オーナー指示）。
// 同日 フードの¥10,000を¥500に差し替え（¥450/¥650に¥500玉で払う客が多い・¥10,000札は「その他」で受ける・オーナー確定）。
export const CASH_UNITS_BY_TERMINAL = {
  food: [50, 100, 500, 1000, 5000],
  drink: [50, 100, 1000, 5000],
};

// 全窓口の金種の和集合。tapsの初期化と合計はこちらを使う
// （窓口を切り替えてもキーが欠落しないように）。
export const ALL_CASH_UNITS = [50, 100, 1000, 5000, 10000];

export function CASH_UNITS_FOR(terminal) {
  return CASH_UNITS_BY_TERMINAL[terminal] ?? CASH_UNITS_BY_TERMINAL.food;
}

// 金種ボタンを2個ずつの行に分ける。画面の縦を増やさないため、
// 最後の行が1個だけなら（奇数個の窓口）そのボタン1個を切り出し、
// 呼び出し側の「その他/クリア」等の行に一緒に並べてもらう。
// 戻り値: { rows: [[unit, unit], ...], danglingUnit: unit|null }
export function cashUnitRows(units) {
  const rows = [];
  for (let i = 0; i + 1 < units.length; i += 2) {
    rows.push([units[i], units[i + 1]]);
  }
  const danglingUnit = units.length % 2 === 1 ? units[units.length - 1] : null;
  return { rows, danglingUnit };
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
