import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSale, editSaleItems, voidSale } from '../src/core/sale.js';

const CART = [
  { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 },
  { product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 },
];

test('createSale: 合計が計算される', () => {
  const s = createSale({ terminal: 'food', seq: 12, items: CART, received: 2000, now: '2026-09-18T19:42:00.000Z' });
  assert.equal(s.total, 1400);
});

test('createSale: 預かりとお釣りが記録される', () => {
  const s = createSale({ terminal: 'food', seq: 12, items: CART, received: 2000, now: '2026-09-18T19:42:00.000Z' });
  assert.equal(s.received, 2000);
  assert.equal(s.change, 600);
});

test('createSale: 預かり未入力ならnullで記録される', () => {
  const s = createSale({ terminal: 'food', seq: 12, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  assert.equal(s.received, null);
  assert.equal(s.change, null);
});

test('createSale: 初期状態はactive・未修正', () => {
  const s = createSale({ terminal: 'food', seq: 12, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  assert.equal(s.status, 'active');
  assert.equal(s.edited, false);
});

test('createSale: idは端末と時刻と連番から作られ一意になる', () => {
  const a = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const b = createSale({ terminal: 'food', seq: 2, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  assert.notEqual(a.id, b.id);
  assert.ok(a.id.startsWith('food-'));
});

test('createSale: itemsは元の配列と別物になる（コピー保存）', () => {
  const cart = [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }];
  const s = createSale({ terminal: 'food', seq: 1, items: cart, received: null, now: '2026-09-18T19:42:00.000Z' });
  cart[0].unit_price = 9999;
  assert.equal(s.items[0].unit_price, 500);
  assert.equal(s.total, 500);
});

test('editSaleItems: 数量を変えると合計が再計算される', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const edited = editSaleItems(s, [
    { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 },
    { product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 },
  ], '2026-09-18T19:50:00.000Z');
  assert.equal(edited.total, 900);
});

test('editSaleItems: 修正するとeditedがtrueになる', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const edited = editSaleItems(s, CART, '2026-09-18T19:50:00.000Z');
  assert.equal(edited.edited, true);
});

test('editSaleItems: updated_atが更新されcreated_atは変わらない', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const edited = editSaleItems(s, CART, '2026-09-18T19:50:00.000Z');
  assert.equal(edited.created_at, '2026-09-18T19:42:00.000Z');
  assert.equal(edited.updated_at, '2026-09-18T19:50:00.000Z');
});

test('editSaleItems: 元のオブジェクトは変更されない', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  editSaleItems(s, [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }], '2026-09-18T19:50:00.000Z');
  assert.equal(s.total, 1400);
  assert.equal(s.edited, false);
});

test('editSaleItems: 預かり金があれば修正後の合計でお釣りを再計算', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: 2000, now: '2026-09-18T19:42:00.000Z' });
  const edited = editSaleItems(s, [
    { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 },
  ], '2026-09-18T19:50:00.000Z');
  assert.equal(edited.total, 500);
  assert.equal(edited.change, 1500);
});

test('voidSale: 取消するとstatusがvoidedになる', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const v = voidSale(s, '2026-09-18T19:55:00.000Z');
  assert.equal(v.status, 'voided');
});

test('voidSale: 取消しても金額と明細は残る（監査用）', () => {
  const s = createSale({ terminal: 'food', seq: 1, items: CART, received: null, now: '2026-09-18T19:42:00.000Z' });
  const v = voidSale(s, '2026-09-18T19:55:00.000Z');
  assert.equal(v.total, 1400);
  assert.equal(v.items.length, 2);
});

test('editSaleItems: 修正で預かり不足になったら預かり記録を無効化する', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 1000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, [
    { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 5 },
  ], '2026-09-18T19:50:00.000Z');
  assert.equal(edited.total, 2500);
  assert.equal(edited.received, null, '不足する預かりは記録から外す');
  assert.equal(edited.change, null, 'お釣り0円という嘘を残さない');
});

test('editSaleItems: 修正後も預かりが足りていれば記録は維持される', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 5000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, [
    { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 5 },
  ], '2026-09-18T19:50:00.000Z');
  assert.equal(edited.received, 5000);
  assert.equal(edited.change, 2500);
});

test('createSale: 同じ時刻・同じ顧客番号でもIDが衝突しない', () => {
  const items = [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }];
  const a = createSale({ terminal: 'food', seq: 9, items, received: null, now: '2026-09-18T19:42:00.000Z' });
  const b = createSale({ terminal: 'food', seq: 9, items, received: null, now: '2026-09-18T19:42:00.000Z' });
  assert.notEqual(a.id, b.id);
});

// --- 預かり金の修正（オーナー要望・2026-08-19） ---

test('editSaleItems: 預かり金を明示的に変更できる', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 2000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, s.items, '2026-09-18T19:50:00.000Z', { received: 5000 });
  assert.equal(edited.total, 1000);
  assert.equal(edited.received, 5000);
  assert.equal(edited.change, 4000);
});

test('editSaleItems: 預かり金をnullにして記録を消せる', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 2000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, s.items, '2026-09-18T19:50:00.000Z', { received: null });
  assert.equal(edited.received, null);
  assert.equal(edited.change, null);
});

test('editSaleItems: 預かり金を後から足せる（登録時に入れ忘れた場合）', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: null, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, s.items, '2026-09-18T19:50:00.000Z', { received: 1500 });
  assert.equal(edited.received, 1500);
  assert.equal(edited.change, 500);
});

test('editSaleItems: 商品と預かり金を同時に変更できる', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 1000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }],
  });
  const edited = editSaleItems(s, [
    { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 3 },
  ], '2026-09-18T19:50:00.000Z', { received: 2000 });
  assert.equal(edited.total, 1500);
  assert.equal(edited.received, 2000);
  assert.equal(edited.change, 500);
});

test('editSaleItems: 指定した預かり金が合計に足りなければ記録を無効化する', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 2000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, s.items, '2026-09-18T19:50:00.000Z', { received: 500 });
  assert.equal(edited.received, null, '不足する預かりは記録しない');
  assert.equal(edited.change, null);
});

test('editSaleItems: 第4引数を省略すると従来通り動く（後方互換）', () => {
  const s = createSale({
    terminal: 'food', seq: 1, received: 2000, now: '2026-09-18T19:42:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  });
  const edited = editSaleItems(s, s.items, '2026-09-18T19:50:00.000Z');
  assert.equal(edited.received, 2000);
  assert.equal(edited.change, 1000);
});
