import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSale, editSaleItems, voidSale } from '../src/core/sale.js';
import { summarize } from '../src/core/summary.js';
import { detailCsv } from '../src/core/csv.js';

function buildSales() {
  const s1 = createSale({
    terminal: 'food', seq: 1, received: 2000, now: '2026-09-18T10:00:00.000Z',
    items: [
      { product_id: 'f1', name: '焼きそば', unit_price: 500, qty: 2 },
      { product_id: 'f2', name: 'たこ焼き', unit_price: 400, qty: 1 },
    ],
  });
  const s2 = createSale({
    terminal: 'food', seq: 2, received: null, now: '2026-09-18T10:05:00.000Z',
    items: [{ product_id: 'f3', name: 'フランクフルト', unit_price: 300, qty: 3 }],
  });
  const s3 = createSale({
    terminal: 'food', seq: 3, received: 5000, now: '2026-09-18T10:10:00.000Z',
    items: [{ product_id: 'f4', name: 'からあげ', unit_price: 400, qty: 2 }],
  });
  return [s1, s2, s3];
}

function csvActiveTotal(sales) {
  const rows = detailCsv(sales).trim().split('\n').slice(1);
  return rows
    .filter((r) => r.split(',')[10] === '有効')
    .reduce((acc, r) => acc + Number(r.split(',')[6]), 0);
}

test('整合: 通常の会計で 集計の総売上 と CSVの小計合計 が一致する', () => {
  const sales = buildSales();
  assert.equal(summarize(sales).totalSales, csvActiveTotal(sales));
});

test('整合: 取消した後も一致する', () => {
  const sales = buildSales();
  sales[1] = voidSale(sales[1], '2026-09-18T10:20:00.000Z');
  const expected = 1400 + 800;
  assert.equal(summarize(sales).totalSales, expected);
  assert.equal(csvActiveTotal(sales), expected);
});

test('整合: 修正した後も一致する', () => {
  const sales = buildSales();
  sales[0] = editSaleItems(sales[0], [
    { product_id: 'f1', name: '焼きそば', unit_price: 500, qty: 1 },
  ], '2026-09-18T10:25:00.000Z');
  const expected = 500 + 900 + 800;
  assert.equal(summarize(sales).totalSales, expected);
  assert.equal(csvActiveTotal(sales), expected);
});

test('整合: 修正と取消を両方行っても一致する', () => {
  const sales = buildSales();
  sales[0] = editSaleItems(sales[0], [
    { product_id: 'f1', name: '焼きそば', unit_price: 500, qty: 3 },
  ], '2026-09-18T10:25:00.000Z');
  sales[2] = voidSale(sales[2], '2026-09-18T10:30:00.000Z');
  const expected = 1500 + 900;
  assert.equal(summarize(sales).totalSales, expected);
  assert.equal(csvActiveTotal(sales), expected);
});

test('整合: 100件の会計でも一致する', () => {
  const sales = [];
  for (let i = 1; i <= 100; i++) {
    sales.push(createSale({
      terminal: 'food', seq: i, received: null,
      now: `2026-09-18T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      items: [{ product_id: 'f1', name: '焼きそば', unit_price: 500, qty: (i % 3) + 1 }],
    }));
  }
  assert.equal(summarize(sales).totalSales, csvActiveTotal(sales));
});
