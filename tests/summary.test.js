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

test('summarize: PayPayの合計額を出す（取消は除外）', () => {
  const sales = [
    { id: 'a', total: 500, status: 'active', payment: 'paypay', items: [] },
    { id: 'b', total: 300, status: 'active', payment: 'cash', items: [] },
    { id: 'c', total: 200, status: 'active', payment: 'paypay', items: [] },
    { id: 'd', total: 900, status: 'voided', payment: 'paypay', items: [] },
    { id: 'e', total: 100, status: 'active', items: [] },
  ];
  assert.equal(summarize(sales).paypayTotal, 700);
});

test('summarize: 未納の合計額も出す', () => {
  const sales = [
    { id: 'a', total: 500, status: 'active', payment: 'unpaid', items: [] },
    { id: 'b', total: 300, status: 'active', payment: 'cash', items: [] },
  ];
  assert.equal(summarize(sales).unpaidTotal, 500);
});

// --- 商品別集計シート（2026-09-24 オーナー要望: 商品ごとの売上をExcelに出す） ---
import { productSheet } from '../src/core/exportsheets.js';

const PSALES = [
  { status: 'active', terminal: 'food', total: 900,
    items: [{ name: '広島焼き', unit_price: 600, qty: 1 }, { name: '冷やしパイン', unit_price: 300, qty: 1 }] },
  { status: 'active', terminal: 'food', total: 1200,
    items: [{ name: '広島焼き', unit_price: 600, qty: 2 }] },
  { status: 'voided', terminal: 'food', total: 650,
    items: [{ name: 'エビフライ（5個入り）', unit_price: 650, qty: 1 }] },
  { status: 'active', terminal: 'food', total: 450, staffName: '山田', payment: 'unpaid',
    items: [{ name: 'フランクフルト', unit_price: 450, qty: 1 }] },
];

test('productSheet: シート名は「商品別」', () => {
  assert.equal(productSheet(PSALES).name, '商品別');
});

test('productSheet: 見出しは 商品名/単価/個数/売上/構成比', () => {
  assert.deepEqual(productSheet(PSALES).rows[0], ['商品名', '単価', '個数', '売上', '構成比(%)']);
});

test('productSheet: 商品ごとに個数と売上を集計する', () => {
  const rows = productSheet(PSALES).rows;
  const hiroshima = rows.find((r) => r[0] === '広島焼き');
  assert.deepEqual(hiroshima.slice(0, 4), ['広島焼き', 600, 3, 1800]);
});

test('productSheet: 取消した会計は含めない', () => {
  const rows = productSheet(PSALES).rows;
  assert.equal(rows.find((r) => r[0] === 'エビフライ（5個入り）'), undefined);
});

test('productSheet: 職員販売は売上に含める', () => {
  const rows = productSheet(PSALES).rows;
  const frank = rows.find((r) => r[0] === 'フランクフルト');
  assert.deepEqual(frank.slice(0, 4), ['フランクフルト', 450, 1, 450]);
});

test('productSheet: 売上の大きい順に並ぶ', () => {
  const body = productSheet(PSALES).rows.slice(1, -1);
  const amounts = body.map((r) => r[3]);
  assert.deepEqual(amounts, [...amounts].sort((a, b) => b - a));
});

test('productSheet: 最終行は合計（個数と売上の総和・構成比100）', () => {
  const rows = productSheet(PSALES).rows;
  const last = rows[rows.length - 1];
  // 広島焼き1800 + パイン300 + フランク450 = 2550 / 個数 3+1+1 = 5
  assert.equal(last[0], '合計');
  assert.equal(last[2], 5);
  assert.equal(last[3], 2550);
  assert.equal(last[4], 100);
});

// この xlsx 生成には書式(styles.xml)が無く、0.382 で出すとExcelに「0.382」と
// 表示されて読めない。パーセントの数値そのもの（38.2）を入れて小数1桁に丸める。
test('productSheet: 構成比はパーセントの数値・小数1桁', () => {
  const body = productSheet(PSALES).rows.slice(1, -1);
  const hiroshima = body.find((r) => r[0] === '広島焼き');
  assert.equal(hiroshima[4], 70.6);  // 1800/2550 = 70.588...
  for (const r of body) {
    assert.equal(Math.round(r[4] * 10) / 10, r[4], `構成比が小数1桁でない: ${r[0]} ${r[4]}`);
  }
});

test('productSheet: 構成比の各行を足すとちょうど100になる', () => {
  const body = productSheet(PSALES).rows.slice(1, -1);
  const sum = body.reduce((s, r) => s + r[4], 0);
  assert.equal(Math.round(sum * 10) / 10, 100, `構成比の合計=${sum}`);
});

test('productSheet: 3等分でも合計100（丸めて99.9にならない）', () => {
  // 100円の商品3つが1個ずつ → 33.3+33.3+33.3=99.9 になってしまう組み合わせ。
  // オーナーが検算した時に合わないので、端数は売上の大きい商品から配る。
  const third = [{ status: 'active', terminal: 'food', total: 300,
    items: [{ name: 'X', unit_price: 100, qty: 1 }, { name: 'Y', unit_price: 100, qty: 1 }, { name: 'Z', unit_price: 100, qty: 1 }] }];
  const body = productSheet(third).rows.slice(1, -1);
  const sum = body.reduce((s, r) => s + r[4], 0);
  assert.equal(Math.round(sum * 10) / 10, 100, `構成比=${body.map((r) => r[4])} 合計=${sum}`);
});

test('productSheet: 端数配分しても各行は小数1桁・元の比率から0.1以上ずれない', () => {
  const body = productSheet(PSALES).rows.slice(1, -1);
  const total = productSheet(PSALES).rows.at(-1)[3];
  for (const r of body) {
    assert.equal(Math.round(r[4] * 10) / 10, r[4], `小数1桁でない: ${r[0]} ${r[4]}`);
    const exact = (r[3] / total) * 100;
    assert.ok(Math.abs(r[4] - exact) <= 0.1 + 1e-9, `${r[0]} 表示${r[4]} vs 実際${exact}`);
  }
});

test('productSheet: 会計が0件でも見出しと合計行は出る（壊れない）', () => {
  const rows = productSheet([]).rows;
  assert.deepEqual(rows[0], ['商品名', '単価', '個数', '売上', '構成比(%)']);
  assert.deepEqual(rows[rows.length - 1], ['合計', '', 0, 0, 0]);
});

test('productSheet: 同じ商品が単価違いで混ざったら単価は「混在」にして合算する', () => {
  // 祭りの途中で値段を変えた場合。どれか1つを書くと取り違えるため単価は出さない
  const mixed = [
    { status: 'active', terminal: 'food', total: 300, items: [{ name: '冷やしパイン', unit_price: 300, qty: 1 }] },
    { status: 'active', terminal: 'food', total: 200, items: [{ name: '冷やしパイン', unit_price: 200, qty: 1 }] },
  ];
  const row = productSheet(mixed).rows.find((r) => r[0] === '冷やしパイン');
  assert.equal(row[1], '混在', '単価が混在する時は「混在」と出す');
  assert.equal(row[2], 2);
  assert.equal(row[3], 500);
});
