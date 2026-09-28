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

test('DEFAULT_PRODUCTS: マルシェの商品が31品ある', () => {
  // 2026-09-28 一味シリーズを3種（一味KAN/すだちの一撃/ひ〜の用心）に分割し
  // ケチャップを追加したため 28 → 31（オーナー確定）
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  assert.equal(marche.length, 31);
});

test('DEFAULT_PRODUCTS: 価格が確定した11品は正しい税込価格が入る', () => {
  // 2026-09-28 オーナー受領（税込）。残りは暫定¥100
  const want = {
    '魚魚': 750, '一味KAN': 680, 'こもだれ': 680, 'すだちの一撃': 680,
    'ひ〜の用心': 680, 'すだちポン酢': 720, 'おい！ポン酢': 720,
    'すだち×はちみつシロップ': 800, 'ケチャップ': 680, 'ススメご飯': 720,
    'ノンオイルドレッシング': 720,
  };
  const byName = Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.name, p.price]));
  for (const [name, price] of Object.entries(want)) {
    assert.equal(byName[name], price, `${name} の価格`);
  }
});

test('DEFAULT_PRODUCTS: マルシェのカテゴリーは受領順の5つ', () => {
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  assert.deepEqual(categoriesOf(marche), ['レスポ', 'こもあん', 'こもれび', 'ベーカリー', 'B型']);
});

test('DEFAULT_PRODUCTS: マルシェの商品は全部カテゴリーを持つ', () => {
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  for (const p of marche) assert.ok(p.category, `${p.name} にカテゴリーが無い`);
});

test('DEFAULT_PRODUCTS: たわしはひらがなで統一（オーナー確定2026-09-25）', () => {
  const names = DEFAULT_PRODUCTS.map((p) => p.name);
  assert.ok(names.includes('アクリルたわし（スマイル）'));
  assert.ok(names.includes('アクリルたわし（くま）'));
  assert.ok(!names.some((n) => n.includes('タワシ')), 'カタカナのタワシが残っている');
});

test('DEFAULT_PRODUCTS: 祭りの商品は今までどおりカテゴリーを持たない', () => {
  const festival = DEFAULT_PRODUCTS.filter((p) => p.terminal !== 'marche');
  assert.equal(festival.length, 15);
  for (const p of festival) assert.equal(p.category, undefined, `${p.name} に予期しないカテゴリー`);
});

test('DEFAULT_PRODUCTS: idが全商品で重複しない', () => {
  const ids = DEFAULT_PRODUCTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('DEFAULT_PRODUCTS: マルシェの並び順は0から連番（タブ順が崩れない）', () => {
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  const orders = marche.map((p) => p.sort_order).sort((a, b) => a - b);
  assert.deepEqual(orders, [...Array(31).keys()], '欠番や重複があるとタブ順が崩れる');
});

// --- 商品グリッドの密度（2026-09-28 こもれび16品が画面から溢れた実測より） ---
import { gridDensity } from '../src/core/products.js';

test('gridDensity: 6品までは3列の大きいボタン', () => {
  assert.equal(gridDensity(1), '');
  assert.equal(gridDensity(6), '');
});

test('gridDensity: 7品以上は4列', () => {
  assert.equal(gridDensity(7), 'reg__grid--dense');
  assert.equal(gridDensity(12), 'reg__grid--dense');
});

test('gridDensity: 品数が多くても4列より詰めない（祭りの支払い完了が見切れるため）', () => {
  // 2026-09-28 5列案を実測で撤回。詰めるとグリッドが縮み、その高さを伝票が取って
  // 祭りの画面で支払い完了ボタンが13〜14pxはみ出した。多い時はスクロールで対応する。
  assert.equal(gridDensity(16), 'reg__grid--dense');
  assert.equal(gridDensity(31), 'reg__grid--dense');
});

test('gridDensity: 0品でも落ちない', () => {
  assert.equal(gridDensity(0), '');
});

// --- スクロールの続き表示（2026-09-28 オーナー要望「先にも商品があると分かるUI」） ---
import { hiddenBelowCount } from '../src/core/products.js';

test('hiddenBelowCount: 全部見えていれば0', () => {
  // 商品16品・1行5列・3行分が見えている → 15品表示、残り1
  assert.equal(hiddenBelowCount({ total: 15, visible: 15 }), 0);
});

test('hiddenBelowCount: 見えていない分の品数を返す', () => {
  assert.equal(hiddenBelowCount({ total: 16, visible: 15 }), 1);
  assert.equal(hiddenBelowCount({ total: 31, visible: 15 }), 16);
});

test('hiddenBelowCount: visibleが多すぎても負にならない', () => {
  assert.equal(hiddenBelowCount({ total: 5, visible: 10 }), 0);
});

test('hiddenBelowCount: 0品でも落ちない', () => {
  assert.equal(hiddenBelowCount({ total: 0, visible: 0 }), 0);
});
