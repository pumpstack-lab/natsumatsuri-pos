import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow } from '../src/core/syncrow.js';
import { createSale } from '../src/core/sale.js';

test('toRow→fromRow の往復で会計が壊れない', () => {
  const sale = createSale({
    terminal: 'food', seq: 3, received: 1000, vouchers: 2,
    staffName: '山田', payment: 'unpaid', now: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'f1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const back = fromRow(toRow(sale));
  assert.equal(back.id, sale.id);
  assert.equal(back.total, sale.total);
  assert.equal(back.staffName, '山田');
  assert.equal(back.payment, 'unpaid');
  assert.equal(back.vouchers, 2);
  assert.deepEqual(back.items, sale.items);
  assert.equal(back.status, 'active');
});

test('toRow: 通常会計はstaff_name=null・payment=cash', () => {
  const sale = createSale({
    terminal: 'drink', seq: 1, received: null, now: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'd1', name: 'ラムネ', unit_price: 200, qty: 1 }],
  });
  const r = toRow(sale);
  assert.equal(r.staff_name, null);
  assert.equal(r.payment, 'cash');
  assert.equal(r.received, null);
});
