// 預かり金ボタンの金種。窓口ごとに異なる（2026-08-20 オーナー確定:
// ドリンクは¥10,000を廃止し¥50を新設。フードは従来通り）。
// 2026-09-16 フードに¥50追加（フランクフルト¥450・エビフライ¥650でお釣りに¥50玉が出るため・オーナー指示）。
// 同日 フードの¥10,000を¥500に差し替え（¥450/¥650に¥500玉で払う客が多い・¥10,000札は「その他」で受ける・オーナー確定）。
export const CASH_UNITS_BY_TERMINAL = {
  marche: [50, 100, 500, 1000, 5000],
  food: [50, 100, 500, 1000, 5000],
  drink: [50, 100, 1000, 5000],
};

// 全窓口の金種の和集合。tapsの初期化と合計はこちらを使う
// （窓口を切り替えてもキーが欠落しないように）。
// ⚠️ CASH_UNITS_BY_TERMINAL に金種を足したら必ずここにも足す。
// 漏らすと emptyCashTaps() がキーを作らず、そのボタンを押しても
// undefined+1=NaN になって預かり金が増えない＝「押せない」ように見える。
// tests/cash.test.js の「ALL_CASH_UNITS: 全窓口が表示する金種を漏れなく含む」が突合する。
// ¥10,000 は現在どの窓口にも出していないが、過去の会計データが taps に持っているため残す。
export const ALL_CASH_UNITS = [50, 100, 500, 1000, 5000, 10000];

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

// 金種ボタンを1回押した時のタップ回数の更新。
// キーが無い金種（金種表に足したのに ALL_CASH_UNITS へ足し忘れた・古い保存データを読んだ）
// でも undefined+1=NaN にせず 1 から数え始める。
// 2026-09-24: ¥500 が NaN になり「押しても効かない」実害が出たため純粋関数に切り出した
// （UIの中に書いたままでは単体テストで守れなかった）。
export function addTap(taps, unit) {
  taps[unit] = (taps[unit] ?? 0) + 1;
  return taps;
}

// 商品券の額面（2026-09-16 オーナー確定: ¥200）。
export const VOUCHER_VALUE = 200;
