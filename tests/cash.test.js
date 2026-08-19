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
