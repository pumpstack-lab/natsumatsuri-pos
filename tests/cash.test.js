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

test('CASH_UNITS_FOR: フードは¥100/¥1,000/¥5,000/¥10,000', () => {
  assert.deepEqual(CASH_UNITS_FOR('food'), [100, 1000, 5000, 10000]);
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
