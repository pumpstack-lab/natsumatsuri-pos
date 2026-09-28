import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRODUCTS, availableProducts, reorderProducts, mergeDefaultProducts } from '../src/core/products.js';

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

// --- mergeDefaultProducts（2026-09-16 実価格反映時のマージ規則） ---

test('mergeDefaultProducts: 名前・価格がdefaultsで上書きされる', () => {
  const stored = [
    { id: 'f2', terminal: 'food', name: '焼きそば', price: 500, sort_order: 1, is_available: true },
  ];
  const defaults = [
    { id: 'f2', terminal: 'food', name: '広島焼き', price: 600, sort_order: 1, is_available: true },
  ];
  const merged = mergeDefaultProducts(stored, defaults);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, '広島焼き');
  assert.equal(merged[0].price, 600);
});

test('mergeDefaultProducts: is_availableとsort_orderはstoredの値を維持する', () => {
  const stored = [
    { id: 'f2', terminal: 'food', name: '焼きそば', price: 500, sort_order: 3, is_available: false },
  ];
  const defaults = [
    { id: 'f2', terminal: 'food', name: '広島焼き', price: 600, sort_order: 1, is_available: true },
  ];
  const merged = mergeDefaultProducts(stored, defaults);
  assert.equal(merged[0].is_available, false);
  assert.equal(merged[0].sort_order, 3);
});

test('mergeDefaultProducts: storedにしかないユーザー追加商品は残る', () => {
  const stored = [
    { id: 'f2', terminal: 'food', name: '焼きそば', price: 500, sort_order: 1, is_available: true },
    { id: 'custom1', terminal: 'food', name: 'たこ焼き', price: 400, sort_order: 5, is_available: true },
  ];
  const defaults = [
    { id: 'f2', terminal: 'food', name: '広島焼き', price: 600, sort_order: 1, is_available: true },
  ];
  const merged = mergeDefaultProducts(stored, defaults);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((p) => p.id === 'custom1' && p.name === 'たこ焼き'));
});

test('mergeDefaultProducts: 引数を変異させない', () => {
  const stored = [
    { id: 'f2', terminal: 'food', name: '焼きそば', price: 500, sort_order: 1, is_available: true },
  ];
  const defaults = [
    { id: 'f2', terminal: 'food', name: '広島焼き', price: 600, sort_order: 1, is_available: true },
  ];
  const storedCopy = JSON.parse(JSON.stringify(stored));
  const defaultsCopy = JSON.parse(JSON.stringify(defaults));
  mergeDefaultProducts(stored, defaults);
  assert.deepEqual(stored, storedCopy);
  assert.deepEqual(defaults, defaultsCopy);
});

test('mergeDefaultProducts: storedが空ならdefaultsと同内容になる', () => {
  const merged = mergeDefaultProducts([], DEFAULT_PRODUCTS);
  assert.deepEqual(merged, DEFAULT_PRODUCTS);
});

// --- カテゴリー（2026-09-25 マルシェ対応） ---
import { categoriesOf, filterByCategory, ALL_CATEGORY } from '../src/core/products.js';

const MARCHE = [
  { id: 'm1', terminal: 'marche', name: 'ハロウィンチャーム', price: 100, category: 'レスポ', sort_order: 0, is_available: true },
  { id: 'm2', terminal: 'marche', name: 'ビーズブレスレット', price: 100, category: 'レスポ', sort_order: 1, is_available: true },
  { id: 'm3', terminal: 'marche', name: 'アクリルたわし（スマイル）', price: 100, category: 'こもあん', sort_order: 2, is_available: true },
  { id: 'm4', terminal: 'marche', name: 'ブローチ', price: 100, category: 'こもあん', sort_order: 3, is_available: false },
  { id: 'm5', terminal: 'marche', name: '魚魚', price: 100, category: 'B型', sort_order: 4, is_available: true },
];

test('categoriesOf: 商品の並び順どおりにカテゴリーが出る（重複なし）', () => {
  assert.deepEqual(categoriesOf(MARCHE), ['レスポ', 'こもあん', 'B型']);
});

test('categoriesOf: 品切れの商品しかないカテゴリーも出る（復活させられるように）', () => {
  const only = [{ id: 'x', terminal: 'marche', name: 'X', price: 100, category: '限定', sort_order: 0, is_available: false }];
  assert.deepEqual(categoriesOf(only), ['限定']);
});

test('categoriesOf: カテゴリーが無い商品（祭り）では空配列＝タブを出さない', () => {
  const festival = [
    { id: 'f1', terminal: 'food', name: '広島焼き', price: 600, sort_order: 0, is_available: true },
    { id: 'f2', terminal: 'food', name: '冷やしパイン', price: 300, sort_order: 1, is_available: true },
  ];
  assert.deepEqual(categoriesOf(festival), []);
});

test('categoriesOf: カテゴリー有りと無しが混ざっても有る分だけ出す', () => {
  const mixed = [
    { id: 'a', terminal: 'marche', name: 'A', price: 100, sort_order: 0, is_available: true },
    { id: 'b', terminal: 'marche', name: 'B', price: 100, category: '雑貨', sort_order: 1, is_available: true },
  ];
  assert.deepEqual(categoriesOf(mixed), ['雑貨']);
});

test('filterByCategory: 指定カテゴリーの商品だけ返す', () => {
  const r = filterByCategory(MARCHE, 'レスポ');
  assert.deepEqual(r.map((p) => p.id), ['m1', 'm2']);
});

test('filterByCategory: ALL_CATEGORY なら全部返す', () => {
  const r = filterByCategory(MARCHE, ALL_CATEGORY);
  assert.deepEqual(r.map((p) => p.id), ['m1', 'm2', 'm3', 'm4', 'm5']);
});

test('filterByCategory: 未指定(null)なら全部返す', () => {
  assert.equal(filterByCategory(MARCHE, null).length, 5);
});

test('filterByCategory: 存在しないカテゴリーなら空（画面は空表示になるだけで落ちない）', () => {
  assert.deepEqual(filterByCategory(MARCHE, 'ない分類'), []);
});
