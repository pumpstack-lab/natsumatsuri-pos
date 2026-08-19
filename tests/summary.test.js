import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, productBreakdown } from '../src/core/summary.js';

const SALES = [
  {
    id: 'food-1', terminal: 'food', seq: 1, total: 1400, status: 'active',
    items: [
      { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 },
      { product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 },
    ],
  },
  {
    id: 'food-2', terminal: 'food', seq: 2, total: 600, status: 'voided',
    items: [{ product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 }],
  },
  {
    id: 'food-3', terminal: 'food', seq: 3, total: 1000, status: 'active',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  },
];

test('summarize: 取消を除いた売上を出す', () => {
  const r = summarize(SALES);
  assert.equal(r.totalSales, 2400);
});

test('summarize: 取消を除いた会計数を出す', () => {
  const r = summarize(SALES);
  assert.equal(r.count, 2);
});

test('summarize: 平均単価を出す（整数に丸める）', () => {
  const r = summarize(SALES);
  assert.equal(r.average, 1200);
});

test('summarize: 会計が0件なら全て0（ゼロ除算しない）', () => {
  const r = summarize([]);
  assert.equal(r.totalSales, 0);
  assert.equal(r.count, 0);
  assert.equal(r.average, 0);
});

test('summarize: 全て取消でも0を返す', () => {
  const r = summarize([{ id: 'x', total: 500, status: 'voided', items: [] }]);
  assert.equal(r.totalSales, 0);
  assert.equal(r.count, 0);
  assert.equal(r.average, 0);
});

test('productBreakdown: 商品別に個数と金額を集計する', () => {
  const r = productBreakdown(SALES);
  const yakisoba = r.find((x) => x.name === '焼きそば');
  assert.equal(yakisoba.qty, 4);
  assert.equal(yakisoba.amount, 2000);
});

test('productBreakdown: 取消の会計は集計に含めない', () => {
  const r = productBreakdown(SALES);
  const takoyaki = r.find((x) => x.name === 'たこ焼き');
  assert.equal(takoyaki.qty, 1);
  assert.equal(takoyaki.amount, 400);
});

test('productBreakdown: 売上金額の多い順に並ぶ', () => {
  const r = productBreakdown(SALES);
  assert.equal(r[0].name, '焼きそば');
});

test('summarize: 商品券の使用枚数を合計する（取消は除外）', () => {
  const sales = [
    { id: 'a', total: 500, status: 'active', vouchers: 3, items: [] },
    { id: 'b', total: 300, status: 'active', vouchers: 2, items: [] },
    { id: 'c', total: 200, status: 'voided', vouchers: 4, items: [] },
    { id: 'd', total: 100, status: 'active', items: [] },
  ];
  assert.equal(summarize(sales).voucherCount, 5, '有効な会計の3+2枚。取消の4枚と未定義は除外');
});
