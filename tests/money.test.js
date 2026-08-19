import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineSubtotal, cartTotal, calcChange } from '../src/core/money.js';

test('lineSubtotal: 単価と個数を掛ける', () => {
  assert.equal(lineSubtotal(500, 2), 1000);
});

test('lineSubtotal: 個数0なら0', () => {
  assert.equal(lineSubtotal(500, 0), 0);
});

test('cartTotal: 複数商品の合計', () => {
  const items = [
    { name: '焼きそば', unit_price: 500, qty: 2 },
    { name: 'たこ焼き', unit_price: 400, qty: 1 },
  ];
  assert.equal(cartTotal(items), 1400);
});

test('cartTotal: 空の伝票は0', () => {
  assert.equal(cartTotal([]), 0);
});

test('cartTotal: 1商品を大量に', () => {
  const items = [{ name: '綿菓子', unit_price: 200, qty: 37 }];
  assert.equal(cartTotal(items), 7400);
});

test('calcChange: 預かりが合計を上回ればお釣りが出る', () => {
  const r = calcChange(1400, 2000);
  assert.equal(r.change, 600);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: ちょうどならお釣り0で完了可', () => {
  const r = calcChange(1400, 1400);
  assert.equal(r.change, 0);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 預かり不足なら完了不可・不足額を返す', () => {
  const r = calcChange(1400, 1000);
  assert.equal(r.change, 0);
  assert.equal(r.shortage, 400);
  assert.equal(r.canComplete, false);
});

test('calcChange: 預かり未入力(null)なら完了可・お釣りは出さない', () => {
  const r = calcChange(1400, null);
  assert.equal(r.change, null);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 伝票が空(合計0)なら完了不可', () => {
  const r = calcChange(0, null);
  assert.equal(r.canComplete, false);
});
