import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRODUCTS, availableProducts, reorderProducts } from '../src/core/products.js';

test('DEFAULT_PRODUCTS: フードとドリンクの両方に仮メニューがある', () => {
  const food = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'food');
  const drink = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'drink');
  assert.ok(food.length >= 4);
  assert.ok(drink.length >= 4);
});

test('DEFAULT_PRODUCTS: 全商品にid・名前・価格がある', () => {
  for (const p of DEFAULT_PRODUCTS) {
    assert.ok(p.id);
    assert.ok(p.name);
    assert.ok(Number.isInteger(p.price));
    assert.ok(p.price > 0);
  }
});

test('DEFAULT_PRODUCTS: idが重複しない', () => {
  const ids = DEFAULT_PRODUCTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('availableProducts: 指定した窓口の商品だけ返す', () => {
  const r = availableProducts(DEFAULT_PRODUCTS, 'food');
  assert.ok(r.every((p) => p.terminal === 'food'));
});

test('availableProducts: 売り切れ(is_available=false)は除外する', () => {
  const list = [
    { id: 'a', terminal: 'food', name: '焼きそば', price: 500, sort_order: 0, is_available: true },
    { id: 'b', terminal: 'food', name: '綿菓子', price: 200, sort_order: 1, is_available: false },
  ];
  const r = availableProducts(list, 'food');
  assert.equal(r.length, 1);
  assert.equal(r[0].name, '焼きそば');
});

test('availableProducts: sort_order順に並ぶ', () => {
  const list = [
    { id: 'a', terminal: 'food', name: 'B', price: 100, sort_order: 2, is_available: true },
    { id: 'b', terminal: 'food', name: 'A', price: 100, sort_order: 1, is_available: true },
  ];
  const r = availableProducts(list, 'food');
  assert.equal(r[0].name, 'A');
});

test('reorderProducts: 並べ替えるとsort_orderが振り直される', () => {
  const list = [
    { id: 'a', terminal: 'food', name: 'A', price: 100, sort_order: 0, is_available: true },
    { id: 'b', terminal: 'food', name: 'B', price: 100, sort_order: 1, is_available: true },
  ];
  const r = reorderProducts(list, ['b', 'a']);
  assert.equal(r.find((p) => p.id === 'b').sort_order, 0);
  assert.equal(r.find((p) => p.id === 'a').sort_order, 1);
});
