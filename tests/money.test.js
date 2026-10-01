import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineSubtotal, cartTotal, calcChange } from '../src/core/money.js';

test('lineSubtotal: 単価と個数を掛ける', () => {
  assert.equal(lineSubtotal(500, 2), 1000);
});

test('lineSubtotal: 個数0なら0', () => {
  assert.equal(lineSubtotal(500, 0), 0);
});

test('cartTotal: 複数商品の合計', () => {
  const items = [
    { name: '焼きそば', unit_price: 500, qty: 2 },
    { name: 'たこ焼き', unit_price: 400, qty: 1 },
  ];
  assert.equal(cartTotal(items), 1400);
});

test('cartTotal: 空の伝票は0', () => {
  assert.equal(cartTotal([]), 0);
});

test('cartTotal: 1商品を大量に', () => {
  const items = [{ name: '綿菓子', unit_price: 200, qty: 37 }];
  assert.equal(cartTotal(items), 7400);
});

test('calcChange: 預かりが合計を上回ればお釣りが出る', () => {
  const r = calcChange(1400, 2000);
  assert.equal(r.change, 600);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: ちょうどならお釣り0で完了可', () => {
  const r = calcChange(1400, 1400);
  assert.equal(r.change, 0);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 預かり不足なら完了不可・不足額を返す', () => {
  const r = calcChange(1400, 1000);
  assert.equal(r.change, 0);
  assert.equal(r.shortage, 400);
  assert.equal(r.canComplete, false);
});

test('calcChange: 預かり未入力(null)なら完了可・お釣りは出さない', () => {
  const r = calcChange(1400, null);
  assert.equal(r.change, null);
  assert.equal(r.shortage, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 伝票が空(合計0)なら完了不可', () => {
  const r = calcChange(0, null);
  assert.equal(r.canComplete, false);
});

// --- 商品券と白紙バグ対応（2026-08-19 オーナー要望） ---

test('calcChange: 伝票が空でも預かり金を入れてクラッシュしない（白紙バグ）', () => {
  const r = calcChange(0, 1000);
  assert.equal(r.canComplete, false, '空の会計は完了できない');
  assert.notEqual(r.change, null, '表示用の値が返る（nullだと画面が落ちる）');
});

test('calcChange: 商品券で全額まかなえたら現金0で完了できる', () => {
  const r = calcChange(300, null, 300);
  assert.equal(r.cashDue, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 商品券を引いた残りが現金でもらう額になる', () => {
  const r = calcChange(1100, null, 300);
  assert.equal(r.cashDue, 800);
  assert.equal(r.canComplete, true, '預かり未入力＝残額ちょうど受領で完了できる');
});

test('calcChange: 商品券+現金でお釣りが出る', () => {
  // 合計¥1,100 - 商品券¥300 = 現金¥800。¥1,000預かり → お釣り¥200
  const r = calcChange(1100, 1000, 300);
  assert.equal(r.change, 200);
  assert.equal(r.canComplete, true);
});

test('calcChange: 商品券を引いても現金が不足なら完了不可', () => {
  const r = calcChange(1100, 500, 300);
  assert.equal(r.shortage, 300);
  assert.equal(r.canComplete, false);
});

test('calcChange: 商品券が合計を超えてもお釣りは出ない（cashDue=0）', () => {
  const r = calcChange(200, null, 300);
  assert.equal(r.cashDue, 0);
  assert.equal(r.canComplete, true);
});

test('calcChange: 商品券なし（第3引数省略）は従来通り', () => {
  const r = calcChange(1400, 2000);
  assert.equal(r.change, 600);
  assert.equal(r.cashDue, 1400);
});

// --- 現場の価格入力（2026-10-01 本番前検証で発見した事故）---
import { parsePriceInput } from '../src/core/money.js';

test('parsePriceInput: カンマ付きを正しく読む（¥1,500を¥1で売る事故の防止）', () => {
  // parseInt('1,500') は 1 を返す。ボタンの表示が「1,500円」なので
  // 職員がカンマごと入力するのは自然な操作
  assert.equal(parsePriceInput('1,500'), 1500);
  assert.equal(parsePriceInput('2,600'), 2600);
  assert.equal(parsePriceInput('1，500'), 1500);   // 全角カンマ
});

test('parsePriceInput: 全角数字を読む（iPadの日本語キーボード）', () => {
  assert.equal(parsePriceInput('４８０'), 480);
  assert.equal(parsePriceInput('１，５００'), 1500);
});

test('parsePriceInput: 通貨記号・空白が混ざっても読む', () => {
  assert.equal(parsePriceInput('¥480'), 480);
  assert.equal(parsePriceInput('480円'), 480);
  assert.equal(parsePriceInput(' 480 '), 480);
});

test('parsePriceInput: 普通の半角数字', () => {
  assert.equal(parsePriceInput('480'), 480);
  assert.equal(parsePriceInput('1'), 1);
});

test('parsePriceInput: 無効な入力は null（勝手に解釈しない）', () => {
  // 「480.5」を480と読むような曖昧な解釈はしない。職員に入れ直してもらう
  for (const bad of ['', '0', '-100', 'abc', '480.5', '4 8 0円です', null, undefined, '１００円くらい']) {
    assert.equal(parsePriceInput(bad), null, `${bad} は無効であるべき`);
  }
});
