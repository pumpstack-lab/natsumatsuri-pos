import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { withTimeout } from '../src/core/timeout.js';
import { appendEntry, DIAG_MAX } from '../src/core/diaglog.js';
import { saleRetryKey } from '../src/core/sale.js';

// --- 2026-10-03 現場「途中でボタンが何も反応しなくなる」の調査で入れた守り ---

test('withTimeout: 時間内に終われば結果をそのまま返す', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, 'x'), 7);
});

test('withTimeout: 返ってこない処理は TimeoutError で打ち切る（保存が止まって支払い完了が永久に効かなくなる事故の防止）', async () => {
  const never = new Promise(() => {});
  await assert.rejects(withTimeout(never, 30, 'putSale'), (e) => e.name === 'TimeoutError' && e.message.includes('putSale'));
});

test('withTimeout: 元の失敗はそのまま伝える', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50, 'x'), /boom/);
});

test('appendEntry: 上限を超えたら古いものから捨てる（端末の容量を食い続けない）', () => {
  let list = [];
  for (let i = 0; i < DIAG_MAX + 5; i++) list = appendEntry(list, { t: i, k: 'x' });
  assert.equal(list.length, DIAG_MAX);
  assert.equal(list[0].t, 5);
  assert.equal(list.at(-1).t, DIAG_MAX + 4);
});

test('appendEntry: 壊れた保存データ（配列でない）でも落ちずに記録を始める', () => {
  assert.deepEqual(appendEntry(null, { k: 'a' }), [{ k: 'a' }]);
  assert.deepEqual(appendEntry('壊れ', { k: 'a' }), [{ k: 'a' }]);
});

test('saleRetryKey: 同じ伝票・同じ預かりなら同じキー（保存失敗→再押しで同じ会計を使い回し、二重登録しない）', () => {
  const cart = [{ product_id: 'm1', name: 'A', unit_price: 300, qty: 2, category: 'x' }];
  const a = saleRetryKey({ terminal: 'marche', items: cart, received: 1000, vouchers: 0, payment: 'cash', staffName: null });
  const b = saleRetryKey({ terminal: 'marche', items: cart.map((i) => ({ ...i })), received: 1000, vouchers: 0, payment: 'cash', staffName: null });
  assert.equal(a, b);
});

test('saleRetryKey: 中身・預かり・支払い方法が変われば別の会計として扱う', () => {
  const cart = [{ product_id: 'm1', name: 'A', unit_price: 300, qty: 2, category: 'x' }];
  const base = { terminal: 'marche', items: cart, received: 1000, vouchers: 0, payment: 'cash', staffName: null };
  const k = saleRetryKey(base);
  assert.notEqual(k, saleRetryKey({ ...base, items: [{ ...cart[0], qty: 3 }] }));
  assert.notEqual(k, saleRetryKey({ ...base, received: 2000 }));
  assert.notEqual(k, saleRetryKey({ ...base, payment: 'paypay' }));
});

// オフライン起動は sw.js の ASSETS に載ったファイルだけで立ち上がる。
// 新しいファイルを足して載せ忘れると、屋台（電波なし）でアプリが起動しない。
test('src の全 .js が sw.js の ASSETS に載っている（オフライン起動の保証）', () => {
  const root = url.fileURLToPath(new URL('../', import.meta.url));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const imported = new Set();
  const walk = (file) => {
    const rel = './' + path.relative(root, file).split(path.sep).join('/');
    if (imported.has(rel)) return;
    imported.add(rel);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import[^'"]*['"](\.[^'"]+)['"]/gm)) walk(path.resolve(path.dirname(file), m[1]));
  };
  walk(path.join(root, 'src/app.js'));
  const missing = [...imported].filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(missing, [], `sw.js の ASSETS に無い: ${missing.join(', ')}`);
});
