import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASH_UNITS, emptyCashTaps, tapsTotal } from '../src/core/cash.js';

test('CASH_UNITS: ¥100が含まれる', () => {
  assert.ok(CASH_UNITS.includes(100));
});

test('CASH_UNITS: 金額の小さい順に並ぶ', () => {
  const sorted = [...CASH_UNITS].sort((a, b) => a - b);
  assert.deepEqual(CASH_UNITS, sorted);
});

test('emptyCashTaps: 全金種が0で初期化される', () => {
  const taps = emptyCashTaps();
  for (const unit of CASH_UNITS) assert.equal(taps[unit], 0);
});

test('emptyCashTaps: 金種を増やしても初期化漏れが起きない', () => {
  assert.equal(Object.keys(emptyCashTaps()).length, CASH_UNITS.length);
});

test('tapsTotal: タップ回数から預かり金を合計する', () => {
  assert.equal(tapsTotal({ 100: 5, 1000: 1, 5000: 0, 10000: 0 }), 1500);
});

test('tapsTotal: ¥100を4回で¥400', () => {
  assert.equal(tapsTotal({ 100: 4, 1000: 0, 5000: 0, 10000: 0 }), 400);
});

test('tapsTotal: 何も押していなければ0', () => {
  assert.equal(tapsTotal(emptyCashTaps()), 0);
});

// --- 窓口別の金種（2026-08-20 オーナー要望: ドリンクは¥10,000廃止・¥50新設） ---
import { CASH_UNITS_FOR, ALL_CASH_UNITS } from '../src/core/cash.js';

test('CASH_UNITS_FOR: フードは¥50/¥100/¥1,000/¥5,000/¥10,000', () => {
  assert.deepEqual(CASH_UNITS_FOR('food'), [50, 100, 500, 1000, 5000]);
});

test('CASH_UNITS_FOR: ドリンクは¥50/¥100/¥1,000/¥5,000（¥10,000なし）', () => {
  assert.deepEqual(CASH_UNITS_FOR('drink'), [50, 100, 1000, 5000]);
});

test('emptyCashTaps: 全窓口の金種をカバーする（窓口切替でキー欠落しない）', () => {
  const taps = emptyCashTaps();
  for (const u of ALL_CASH_UNITS) assert.equal(taps[u], 0);
});

test('tapsTotal: ¥50を3回で¥150', () => {
  const taps = emptyCashTaps();
  taps[50] = 3;
  assert.equal(tapsTotal(taps), 150);
});

// --- 表示する金種とカウンタのキーがズレていないことを守る ---
// 2026-09-24 実害: フードの¥10,000を¥500に差し替えた時 ALL_CASH_UNITS を直し忘れ、
// ¥500ボタンを押しても taps[500] が undefined+1=NaN になり預かり金が増えず、
// 「金額のボタンが押せない」と現場から報告が来た。以後この2つは必ず突合する。
import { CASH_UNITS_BY_TERMINAL } from '../src/core/cash.js';

test('ALL_CASH_UNITS: 全窓口が表示する金種を漏れなく含む', () => {
  for (const [terminal, units] of Object.entries(CASH_UNITS_BY_TERMINAL)) {
    for (const u of units) {
      assert.ok(
        ALL_CASH_UNITS.includes(u),
        `${terminal}窓口が表示する¥${u}が ALL_CASH_UNITS に無い（押しても効かなくなる）`
      );
    }
  }
});

test('emptyCashTaps: 全窓口が表示する金種のキーを持つ', () => {
  const taps = emptyCashTaps();
  for (const [terminal, units] of Object.entries(CASH_UNITS_BY_TERMINAL)) {
    for (const u of units) {
      assert.equal(taps[u], 0, `${terminal}窓口の¥${u}のキーが無い`);
    }
  }
});

test('¥500を押すと預かり金が¥500増える（フード窓口）', () => {
  const taps = emptyCashTaps();
  taps[500] += 1;
  assert.equal(taps[500], 1, '¥500のタップ回数が NaN になっている');
  assert.equal(tapsTotal(taps), 500);
});

test('¥500を2回・¥100を1回で¥1,100', () => {
  const taps = emptyCashTaps();
  taps[500] += 1;
  taps[500] += 1;
  taps[100] += 1;
  assert.equal(tapsTotal(taps), 1100);
});

test('tapsTotal: ¥500のキーが無い古い保存データでもNaNにならない', () => {
  // 既にiPadに残っている会計（500キー無し）を読んでも合計が壊れないこと
  assert.equal(tapsTotal({ 50: 0, 100: 1, 1000: 0, 5000: 0, 10000: 0 }), 100);
});
