import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx } from '../src/core/xlsx.js';
import { detailSheet, summarySheet } from '../src/core/exportsheets.js';
import { createSale, voidSale } from '../src/core/sale.js';
import { summarize } from '../src/core/summary.js';

const SALES = (() => {
  const a = createSale({
    terminal: 'food', seq: 1, received: 2000, vouchers: 1, now: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'f1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const b = createSale({
    terminal: 'food', seq: 2, received: null, staffName: '山田', payment: 'unpaid', now: '2026-09-18T10:05:00.000Z',
    items: [{ product_id: 'f2', name: 'エビフライ', unit_price: 300, qty: 1 }],
  });
  const c = voidSale(createSale({
    terminal: 'food', seq: 3, received: null, now: '2026-09-18T10:10:00.000Z',
    items: [{ product_id: 'f3', name: 'フランクフルト', unit_price: 300, qty: 2 }],
  }), '2026-09-18T10:15:00.000Z');
  return [a, b, c];
})();

test('buildXlsx: ZIPシグネチャで始まりEOCDで終わる', () => {
  const bytes = buildXlsx([detailSheet(SALES)]);
  assert.equal(bytes[0], 0x50); // P
  assert.equal(bytes[1], 0x4b); // K
  const tail = bytes.slice(-22);
  assert.equal(tail[0], 0x50);
  assert.equal(tail[1], 0x4b);
  assert.equal(tail[2], 0x05);
  assert.equal(tail[3], 0x06);
});

test('detailSheet: 単価・個数・小計は数値セルになる', () => {
  const { rows } = detailSheet(SALES);
  assert.equal(typeof rows[1][4], 'number');
  assert.equal(typeof rows[1][5], 'number');
  assert.equal(typeof rows[1][6], 'number');
});

test('detailSheet: 有効行の小計合計が総売上と一致（Excel移行後も集計が狂わない）', () => {
  const { rows } = detailSheet(SALES);
  const sum = rows.slice(1).filter((r) => r[10] === '有効').reduce((a, r) => a + r[6], 0);
  assert.equal(sum, summarize(SALES).totalSales);
});

test('summarySheet: 1会計1行・職員名と支払いが入る', () => {
  const { rows } = summarySheet(SALES);
  assert.equal(rows.length, 4);
  const staff = rows.find((r) => r[10] === '山田');
  assert.ok(staff);
  assert.equal(staff[9], '未納');
});

test('detailSheet: 列構成がテンプレートと同じ（K列=状態・M列=商品券・N列=支払い）', () => {
  const { rows } = detailSheet(SALES);
  assert.equal(rows[0][10], '状態');
  assert.equal(rows[0][12], '商品券');
  assert.equal(rows[0][13], '支払い');
});
