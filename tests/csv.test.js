import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailCsv, summaryCsv, csvFileName, BOM } from '../src/core/csv.js';

const SALES = [
  {
    id: 'food-a', terminal: 'food', seq: 1, total: 1400, received: 2000, change: 600,
    status: 'active', edited: false, created_at: '2026-09-18T10:42:00.000Z',
    items: [
      { product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 },
      { product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 },
    ],
  },
  {
    id: 'food-b', terminal: 'food', seq: 2, total: 600, received: null, change: null,
    status: 'voided', edited: false, created_at: '2026-09-18T10:45:00.000Z',
    items: [{ product_id: 'p2', name: 'たこ焼き', unit_price: 400, qty: 1 }],
  },
];

test('detailCsv: ヘッダー行がある', () => {
  const rows = detailCsv(SALES).split('\n');
  assert.equal(rows[0], '会計ID,顧客番号,窓口,商品名,単価,個数,小計,会計合計,預かり,お釣り,状態,登録時刻,商品券');
});

test('detailCsv: 1商品につき1行出る', () => {
  const rows = detailCsv(SALES).trim().split('\n');
  assert.equal(rows.length, 4);
});

test('detailCsv: 取消した会計も出力する（状態列に取消）', () => {
  const csv = detailCsv(SALES);
  assert.ok(csv.includes('取消'));
});

test('detailCsv: 有効な行の小計合計が総売上と一致する', () => {
  const rows = detailCsv(SALES).trim().split('\n').slice(1);
  const sum = rows
    .filter((r) => r.split(',')[10] === '有効')
    .reduce((acc, r) => acc + Number(r.split(',')[6]), 0);
  assert.equal(sum, 1400);
});

test('detailCsv: 預かり未入力は空欄になる', () => {
  const rows = detailCsv(SALES).trim().split('\n');
  const voided = rows.find((r) => r.includes('food-b'));
  const cols = voided.split(',');
  assert.equal(cols[8], '');
  assert.equal(cols[9], '');
});

test('detailCsv: 商品名にカンマがあっても引用符で囲まれる', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 300, received: null, change: null,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p9', name: 'ドリンク,大', unit_price: 300, qty: 1 }],
  }];
  const row = detailCsv(sales).trim().split('\n')[1];
  assert.ok(row.includes('"ドリンク,大"'));
  assert.equal(row.split(',').length, 14);
});

test('detailCsv: 商品名に引用符があっても二重化される', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 300, received: null, change: null,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p9', name: '特大"S"', unit_price: 300, qty: 1 }],
  }];
  const row = detailCsv(sales).trim().split('\n')[1];
  assert.ok(row.includes('"特大""S"""'));
});

test('summaryCsv: 1会計につき1行出る', () => {
  const rows = summaryCsv(SALES).trim().split('\n');
  assert.equal(rows.length, 3);
});

test('summaryCsv: 商品内訳が読める形で入る', () => {
  const csv = summaryCsv(SALES);
  assert.ok(csv.includes('焼きそば×2'));
});

test('csvFileName: 窓口と日付が入る', () => {
  const name = csvFileName('food', 'detail', new Date('2026-09-18T10:00:00.000Z'));
  assert.ok(name.startsWith('natsumatsuri_food_detail_'));
  assert.ok(name.endsWith('.csv'));
});

test('BOM: UTF-8のBOMである', () => {
  assert.equal(BOM, '﻿');
});

test('detailCsv: 商品名にCR(復帰)が入っても行が割れない', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 300, received: null, change: null,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p9', name: '焼き\rそば', unit_price: 300, qty: 1 }],
  }];
  const lines = detailCsv(sales).trim().split('\n');
  assert.equal(lines.length, 2, 'ヘッダー1行 + データ1行');
});

test('detailCsv: =で始まる商品名がExcelで数式として実行されない', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 300, received: null, change: null,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p9', name: '=1+1', unit_price: 300, qty: 1 }],
  }];
  const row = detailCsv(sales).trim().split('\n')[1];
  assert.ok(!row.includes(',=1+1,'), '素の=1+1がそのまま出てはいけない');
});

test('detailCsv: 商品券の枚数が末尾列に出る', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 1000, received: 1000, change: 300, vouchers: 3,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 2 }],
  }];
  const rows = detailCsv(sales).trim().split('\n');
  assert.ok(rows[0].endsWith(',商品券'), 'ヘッダー末尾に商品券列');
  assert.ok(rows[1].endsWith(',3'), 'データ行の末尾に枚数');
});

test('detailCsv: 商品券0枚は空欄になる', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 500, received: null, change: null, vouchers: 0,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }],
  }];
  assert.ok(detailCsv(sales).trim().split('\n')[1].endsWith(','), '0枚は空欄');
});

test('detailCsv: 状態列の位置は変わらない（既存の集計手順を壊さない）', () => {
  const sales = [{
    id: 'x', terminal: 'food', seq: 1, total: 500, received: null, change: null, vouchers: 1,
    status: 'active', edited: false, created_at: '2026-09-18T10:00:00.000Z',
    items: [{ product_id: 'p1', name: '焼きそば', unit_price: 500, qty: 1 }],
  }];
  const row = detailCsv(sales).trim().split('\n')[1];
  assert.equal(row.split(',')[10], '有効', '状態は11列目(K列)のまま');
});
