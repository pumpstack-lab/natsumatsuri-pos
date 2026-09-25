# こもれじ マルシェ対応（イベント切替＋カテゴリー階層）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 祭り専用だったレジを、イベント（祭り／マルシェ）を切り替えて使えるようにし、マルシェでは商品をカテゴリータブで絞り込めるようにする。

**Architecture:** 既存の `terminal`（窓口）をイベント識別子として流用する。`marche` を足すだけなので、保存済みの祭りの売上（`terminal: 'food' / 'drink'`）は一切変更せず、DBマイグレーションも不要。カテゴリーは商品に `category` 文字列を1つ持たせ、商品配列から導出する（カテゴリー用のストアは作らない）。カテゴリーを持たないイベント（祭り）ではタブを描画しないので既存画面は無変更。

**Tech Stack:** Vanilla JS (ES modules) / IndexedDB / node --test / Playwright

**設計書:** `docs/superpowers/specs/2026-09-25-marche-category-design.md`

**全体の前提:**
- 作業ディレクトリは `/Users/Yutalow420/Desktop/01 開発/natsumatsuri-pos`
- テストは `npm test`（node --test）。実ブラウザ検証は別ターミナルで `python3 -m http.server 8087` を起動してから `python3 scripts/xxx.py`
- **既存の132テストを1件も壊さないこと。** 各タスクの最後に必ず `npm test` 全体を通す
- 祭りの売上データ・`src/core/sale.js` / `syncrow.js` / `db.js` / 明細・サマリーシートの列構成は**触らない**

---

### Task 1: イベント定義を作る

**Files:**
- Create: `src/core/events.js`
- Test: `tests/events.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/events.test.js` を新規作成:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, eventById, eventLabel } from '../src/core/events.js';

test('EVENTS: マルシェ・フード・ドリンクの3つ', () => {
  assert.deepEqual(EVENTS.map((e) => e.id), ['marche', 'food', 'drink']);
});

test('EVENTS: マルシェだけがカテゴリーを持つ', () => {
  assert.equal(eventById('marche').hasCategories, true);
  assert.equal(eventById('food').hasCategories, false);
  assert.equal(eventById('drink').hasCategories, false);
});

test('EVENTS: 祭りの2つは名前に（夏祭り）が付く', () => {
  assert.equal(eventById('food').name, 'フード（夏祭り）');
  assert.equal(eventById('drink').name, 'ドリンク（夏祭り）');
});

test('eventById: 知らないidならundefined', () => {
  assert.equal(eventById('unknown'), undefined);
  assert.equal(eventById(null), undefined);
});

test('eventLabel: アイコン付きの表示名を返す', () => {
  assert.equal(eventLabel('marche'), '🛍 マルシェ');
  assert.equal(eventLabel('food'), '🍔 フード（夏祭り）');
});

test('eventLabel: 知らないidならそのidをそのまま返す（画面が壊れない）', () => {
  assert.equal(eventLabel('unknown'), 'unknown');
  assert.equal(eventLabel(null), '');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: FAIL（`Cannot find module '../src/core/events.js'`）

- [ ] **Step 3: 実装する**

`src/core/events.js` を新規作成:

```javascript
// このレジを使うイベント。id は売上データの terminal の値としてそのまま保存される。
// 2026-09-25: 元は「窓口（フード/ドリンク）」だったものをイベントとして使う。
// 祭りの売上は terminal: 'food' / 'drink' で既に保存済みなので、この2つのidは変えない
// （変えると過去の売上が表示されなくなる）。
export const EVENTS = [
  { id: 'marche', name: 'マルシェ', icon: '🛍', hasCategories: true },
  { id: 'food', name: 'フード（夏祭り）', icon: '🍔', hasCategories: false },
  { id: 'drink', name: 'ドリンク（夏祭り）', icon: '🥤', hasCategories: false },
];

export function eventById(id) {
  return EVENTS.find((e) => e.id === id);
}

// 画面に出す「🛍 マルシェ」形式の名前。知らないidでも落とさない。
export function eventLabel(id) {
  if (!id) return '';
  const e = eventById(id);
  return e ? `${e.icon} ${e.name}` : id;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（既存132件＋新規6件＝138件）

- [ ] **Step 5: コミット**

```bash
git add src/core/events.js tests/events.test.js
git commit -m "feat: イベント定義（マルシェ／フード・ドリンク）を追加

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: マルシェの金種を追加

**Files:**
- Modify: `src/core/cash.js:5-8`
- Test: `tests/cash.test.js`（末尾に追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/cash.test.js` の末尾に追記:

```javascript

test('CASH_UNITS_FOR: マルシェはフードと同じ5種', () => {
  assert.deepEqual(CASH_UNITS_FOR('marche'), [50, 100, 500, 1000, 5000]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: FAIL 1件（`CASH_UNITS_FOR('marche')` が food のフォールバックで同じ値を返すため**実は通ってしまう**。通った場合はそれで良い＝フォールバックが意図どおり働いている証拠なので Step 3 で明示的に定義する）

- [ ] **Step 3: 実装する**

`src/core/cash.js` の `CASH_UNITS_BY_TERMINAL` を以下に置き換える:

```javascript
export const CASH_UNITS_BY_TERMINAL = {
  marche: [50, 100, 500, 1000, 5000],
  food: [50, 100, 500, 1000, 5000],
  drink: [50, 100, 1000, 5000],
};
```

（既存のコメントブロックはそのまま残し、marche の行を先頭に足す）

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（139件）

既存の「ALL_CASH_UNITS: 全窓口が表示する金種を漏れなく含む」テストが marche も対象に含めて通ることを確認する（このテストは `CASH_UNITS_BY_TERMINAL` を全部なめるので自動的にカバーされる）。

- [ ] **Step 5: コミット**

```bash
git add src/core/cash.js tests/cash.test.js
git commit -m "feat: マルシェの預かり金の金種を追加（フードと同じ5種）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: カテゴリーの導出関数

**Files:**
- Modify: `src/core/products.js`（`availableProducts` の下に追加）
- Test: `tests/products.test.js`（末尾に追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/products.test.js` の末尾に追記:

```javascript

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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: FAIL（`categoriesOf is not a function` 等）

- [ ] **Step 3: 実装する**

`src/core/products.js` の `availableProducts` 関数の直後に追加:

```javascript
// カテゴリータブの「すべて」を表す番兵。商品の category と衝突しない値にする。
export const ALL_CATEGORY = '__all__';

// 商品配列からカテゴリーの一覧を作る。並び順は商品の並び順に従う
// （カテゴリー順という別概念を作らず、商品を並べ替えればタブ順も追随する）。
// category を持たない商品（祭りのフード・ドリンク）しか無ければ空配列を返し、
// 呼び出し側はタブを描画しない＝既存の画面が変わらない。
export function categoriesOf(products) {
  const seen = [];
  for (const p of [...products].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!p.category) continue;
    if (!seen.includes(p.category)) seen.push(p.category);
  }
  return seen;
}

// 選択中のカテゴリーで商品を絞る。ALL_CATEGORY / 未指定なら絞らない。
export function filterByCategory(products, category) {
  if (!category || category === ALL_CATEGORY) return products;
  return products.filter((p) => p.category === category);
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（147件）

- [ ] **Step 5: コミット**

```bash
git add src/core/products.js tests/products.test.js
git commit -m "feat: 商品のカテゴリー導出・絞り込み関数を追加

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: マルシェの商品28品を初期データに追加

**Files:**
- Modify: `src/core/products.js`（`DEFAULT_PRODUCTS` と `PRODUCTS_SEED_VERSION`）
- Test: `tests/products.test.js`（末尾に追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/products.test.js` の末尾に追記:

```javascript

test('DEFAULT_PRODUCTS: マルシェの商品が28品ある', () => {
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  assert.equal(marche.length, 28);
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
  assert.deepEqual(marche.map((p) => p.sort_order), [...Array(28).keys()]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: FAIL（マルシェ商品が0件）

- [ ] **Step 3: 実装する**

`src/core/products.js` の `DEFAULT_PRODUCTS` 配列の**先頭**（`// 2026-09-16 行事計画書の実価格です。` の行の直前）に以下を挿入:

```javascript
  // --- マルシェ（2026-09-25 オーナー受領の28品）---
  // ⚠️ 価格は全品「暫定 ¥100」。確定したら price を書き換えて PRODUCTS_SEED_VERSION を上げる
  //    （上げないと既にアプリを開いた端末に反映されない）。
  //    当日の朝以降は seed version を上げないこと（現場で直した価格を上書きしてしまう）。
  { id: 'm01', terminal: 'marche', name: 'ハロウィンチャーム', price: 100, category: 'レスポ', sort_order: 0, is_available: true },
  { id: 'm02', terminal: 'marche', name: 'ビーズブレスレット', price: 100, category: 'レスポ', sort_order: 1, is_available: true },
  { id: 'm03', terminal: 'marche', name: 'アクリルたわし（スマイル）', price: 100, category: 'こもあん', sort_order: 2, is_available: true },
  { id: 'm04', terminal: 'marche', name: 'アクリルたわし（くま）', price: 100, category: 'こもあん', sort_order: 3, is_available: true },
  { id: 'm05', terminal: 'marche', name: 'キーホルダー（スマイル）', price: 100, category: 'こもあん', sort_order: 4, is_available: true },
  { id: 'm06', terminal: 'marche', name: 'キーホルダー（肉球）', price: 100, category: 'こもあん', sort_order: 5, is_available: true },
  { id: 'm07', terminal: 'marche', name: 'キーホルダー（お花）', price: 100, category: 'こもあん', sort_order: 6, is_available: true },
  { id: 'm08', terminal: 'marche', name: 'ブローチ', price: 100, category: 'こもあん', sort_order: 7, is_available: true },
  { id: 'm09', terminal: 'marche', name: 'ボタンかざり', price: 100, category: 'こもあん', sort_order: 8, is_available: true },
  { id: 'm10', terminal: 'marche', name: 'キーホルダー（紙粘土）', price: 100, category: 'こもれび', sort_order: 9, is_available: true },
  { id: 'm11', terminal: 'marche', name: 'アクリルキーホルダー', price: 100, category: 'こもれび', sort_order: 10, is_available: true },
  { id: 'm12', terminal: 'marche', name: '編み物', price: 100, category: 'こもれび', sort_order: 11, is_available: true },
  { id: 'm13', terminal: 'marche', name: 'みかんちゃん大', price: 100, category: 'こもれび', sort_order: 12, is_available: true },
  { id: 'm14', terminal: 'marche', name: 'みかんちゃん小', price: 100, category: 'こもれび', sort_order: 13, is_available: true },
  { id: 'm15', terminal: 'marche', name: 'すだちとはちみつシロップ', price: 100, category: 'こもれび', sort_order: 14, is_available: true },
  { id: 'm16', terminal: 'marche', name: 'すすめご飯', price: 100, category: 'こもれび', sort_order: 15, is_available: true },
  { id: 'm17', terminal: 'marche', name: 'ちゅるちゅるみかん', price: 100, category: 'こもれび', sort_order: 16, is_available: true },
  { id: 'm18', terminal: 'marche', name: 'ノンオイルドレッシング', price: 100, category: 'こもれび', sort_order: 17, is_available: true },
  { id: 'm19', terminal: 'marche', name: 'おいポン酢', price: 100, category: 'こもれび', sort_order: 18, is_available: true },
  { id: 'm20', terminal: 'marche', name: 'すだちポン酢', price: 100, category: 'こもれび', sort_order: 19, is_available: true },
  { id: 'm21', terminal: 'marche', name: '一味シリーズ', price: 100, category: 'こもれび', sort_order: 20, is_available: true },
  { id: 'm22', terminal: 'marche', name: 'カレンダー', price: 100, category: 'こもれび', sort_order: 21, is_available: true },
  { id: 'm23', terminal: 'marche', name: 'とんだバナナ１本', price: 100, category: 'ベーカリー', sort_order: 22, is_available: true },
  { id: 'm24', terminal: 'marche', name: 'とんだバナナカット', price: 100, category: 'ベーカリー', sort_order: 23, is_available: true },
  { id: 'm25', terminal: 'marche', name: 'トマト&バジルのプリッツ', price: 100, category: 'ベーカリー', sort_order: 24, is_available: true },
  { id: 'm26', terminal: 'marche', name: '晩白柚とピスタチオのビスコッティ', price: 100, category: 'ベーカリー', sort_order: 25, is_available: true },
  { id: 'm27', terminal: 'marche', name: '魚魚', price: 100, category: 'B型', sort_order: 26, is_available: true },
  { id: 'm28', terminal: 'marche', name: 'こもだれ', price: 100, category: 'B型', sort_order: 27, is_available: true },

```

同じファイルの `PRODUCTS_SEED_VERSION` を更新:

```javascript
export const PRODUCTS_SEED_VERSION = '2026-09-25-marche';
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（154件）

- [ ] **Step 5: コミット**

```bash
git add src/core/products.js tests/products.test.js
git commit -m "feat: マルシェの商品28品を初期データに追加（価格は暫定100円）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: トップ画面をイベント選択に変える

**Files:**
- Modify: `src/ui/screen-top.js`（全面）
- Modify: `styles.css`（`.pick--marche` を追加）

このタスクはUI描画なので単体テストではなく実ブラウザで確認する（Task 8 の検証スクリプトで自動化する）。

- [ ] **Step 1: screen-top.js を書き換える**

`src/ui/screen-top.js` を以下の内容に置き換える:

```javascript
import { state, go, setTerminal, resetCart, render } from './state.js';
import { summarize } from '../core/summary.js';
import { openMerged } from './screen-merged.js';
import { EVENTS, eventById, eventLabel } from '../core/events.js';
import { BUILD } from '../version.js';

const YEN = (n) => `¥${n.toLocaleString('ja-JP')}`;

function terminalStats(terminal) {
  const sales = state.sales.filter((s) => s.terminal === terminal);
  return summarize(sales);
}

async function pick(terminal) {
  // 同じイベントに入り直す時は入力中の伝票を保持する
  // （履歴を見に行って戻っただけで消えるのを防ぐ・2026-08-19 オーナー指摘）
  if (state.terminal === terminal) {
    go('register');
    return;
  }
  if (state.terminal && state.terminal !== terminal) {
    const e = eventById(terminal);
    const name = e ? e.name : terminal;
    const ok = confirm(`この端末を「${name}」に切り替えます。よろしいですか？\n\n（登録済みの売上は消えません。入力中の伝票はクリアされます）`);
    if (!ok) return;
  }
  await setTerminal(terminal);
  resetCart();
  state.category = null;   // イベントを変えたらカテゴリー選択はリセット
  go('register');
}

export function renderTop() {
  const el = document.createElement('div');
  el.className = 'screen';

  const mine = state.terminal ? terminalStats(state.terminal) : { totalSales: 0 };

  el.innerHTML = `
    <div class="top">
      <div class="top__lead">
        <h1>どのイベントですか？</h1>
        <p>選ぶとこの端末に記憶されます</p>
      </div>
      <div class="top__pick">
        ${EVENTS.map((e) => {
          const st = terminalStats(e.id);
          return `
        <button class="pick pick--${e.id}${state.terminal === e.id ? ' is-current' : ''}" data-pick="${e.id}">
          <span class="pick__icon">${e.icon}</span>
          <span class="pick__name">${e.name}</span>
          <span class="pick__meta">${st.count === 0 ? '未使用' : `${st.count}組 / ${YEN(st.totalSales)}`}</span>
        </button>`;
        }).join('')}
      </div>
      <div class="top__menu">
        <button data-go="history">📋 履歴・集計</button>
        <button data-go="products">🍳 商品の設定</button>
        <button data-go="export">📤 Excel書き出し</button>
        <button data-merged>🌐 合算履歴</button>
      </div>
      <div class="top__ver">ver ${BUILD}</div>
      <div class="top__total">
        <span>${state.terminal ? eventLabel(state.terminal) : 'この端末'}の売上</span>
        <strong>${YEN(mine.totalSales)}</strong>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => pick(btn.dataset.pick));
  });
  el.querySelector('[data-merged]').addEventListener('click', openMerged);
  el.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.terminal && btn.dataset.go !== 'products') {
        alert('先にイベントを選んでください。');
        return;
      }
      go(btn.dataset.go);
    });
  });

  return el;
}
```

- [ ] **Step 2: styles.css にマルシェの色と選択中の印を追加**

`styles.css` の `.pick--drink` を定義している行を探し、その直後に追加:

```css
.pick--marche { background: #f7f2ff; border-color: #ddd0f0; }
/* いま選ばれているイベントを一目で分かるようにする（3つ並ぶので迷わないように） */
.pick.is-current { border-width: 3px; border-color: var(--blue); }
```

（`.pick--food` / `.pick--drink` の既存定義は変更しない）

- [ ] **Step 3: テストを実行して既存を壊していないことを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（154件・変化なし）

- [ ] **Step 4: ローカルで目視確認**

別ターミナルで `python3 -m http.server 8087` を起動した状態で:

```bash
python3 - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1080,"height":620}); pg=ctx.new_page()
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(800)
    print(pg.evaluate("()=>document.querySelector('.top__lead h1').textContent"))
    print(pg.evaluate("()=>[...document.querySelectorAll('[data-pick]')].map(b=>b.dataset.pick)"))
    pg.screenshot(path="/tmp/top_marche.png")
    b.close()
PY
```

Expected: `どのイベントですか？` と `['marche', 'food', 'drink']` が出る。
スクリーンショット `/tmp/top_marche.png` を Read ツールで開き、3つのカードが崩れず並んでいることを目視する。

- [ ] **Step 5: コミット**

```bash
git add src/ui/screen-top.js styles.css
git commit -m "feat: トップ画面を窓口選択からイベント選択に変更

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: レジ画面にカテゴリータブを追加

**Files:**
- Modify: `src/ui/state.js`（`state` に `category` を追加）
- Modify: `src/ui/screen-register.js`（タブの描画とイベント）
- Modify: `styles.css`（`.cattabs`）

- [ ] **Step 1: state に category を足す**

`src/ui/state.js` の `state` オブジェクトの `historyTab: 'list',` の直後に追加:

```javascript
  category: null,          // 選択中のカテゴリー（null = すべて）。端末には保存しない
```

同ファイルの `resetCart()` の中、`state.keypadOpen = false;` の直後に追加:

```javascript
  state.category = null;   // 会計が終わったら先頭タブ（すべて）に戻す（オーナー確定2026-09-25）
```

- [ ] **Step 2: screen-register.js にタブを足す**

`src/ui/screen-register.js` の import 文に追加（`availableProducts` を読んでいる行を置き換え）:

```javascript
import { availableProducts, categoriesOf, filterByCategory, ALL_CATEGORY } from '../core/products.js';
```

`renderRegister()` の中、`const products = availableProducts(state.products, state.terminal);` の直後に追加:

```javascript
  // カテゴリータブ。カテゴリーを持たないイベント（祭り）では cats が空になり、
  // タブを描画しないので既存の画面と同じ見た目になる。
  const myProducts = state.products.filter((x) => x.terminal === state.terminal);
  const cats = categoriesOf(myProducts);
  const currentCat = state.category ?? ALL_CATEGORY;
  const shown = cats.length === 0 ? products : filterByCategory(products, currentCat);
```

同じ関数内の商品グリッド描画を探す。現在の以下の部分:

```javascript
        <div class="reg__grid ${products.length > 6 ? 'reg__grid--dense' : ''}">
          ${products.map((p) => `
```

を、次に置き換える（`products` → `shown` の2箇所）:

```javascript
        ${cats.length > 0 ? `
        <div class="cattabs">
          <button data-cat="${ALL_CATEGORY}" class="${currentCat === ALL_CATEGORY ? 'is-on' : ''}">すべて</button>
          ${cats.map((c) => `<button data-cat="${esc(c)}" class="${currentCat === c ? 'is-on' : ''}">${esc(c)}</button>`).join('')}
        </div>` : ''}
        <div class="reg__grid ${shown.length > 6 ? 'reg__grid--dense' : ''}">
          ${shown.length === 0 ? '<div class="cart__empty">この分類に売れる商品がありません</div>' : shown.map((p) => `
```

同じ関数の末尾、`el.querySelectorAll('[data-add]')` のリスナー登録の直前に追加:

```javascript
  el.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat === ALL_CATEGORY ? null : btn.dataset.cat;
      render();
    });
  });
```

⚠️ `[data-add]` のリスナーは `products.find(...)` を使っているが、これは**絞り込み前の全商品から探すので変更不要**（タブで絞っても正しい商品が見つかる）。

- [ ] **Step 3: styles.css にタブのスタイルを追加**

`styles.css` の `.reg__grid {` の定義の**直前**に追加:

```css
/* カテゴリータブ。マルシェのように商品が多いイベントで使う。
   横に入りきらない時は横スクロール（縦を食うと商品グリッドが潰れるため）。 */
.cattabs {
  display: flex; gap: 6px; padding: 8px 10px 0;
  overflow-x: auto; flex: 0 0 auto;
}
.cattabs button {
  flex: 0 0 auto; padding: 10px 16px; min-height: 44px;
  background: #fff; border: 2px solid var(--line); border-radius: 999px;
  font-size: 16px; font-weight: 700; color: var(--gray); white-space: nowrap;
}
.cattabs button.is-on { background: var(--blue); border-color: var(--blue); color: #fff; }
```

- [ ] **Step 4: テストを実行して既存を壊していないことを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（154件・変化なし）

- [ ] **Step 5: ローカルで動作を目視確認**

```bash
python3 - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1080,"height":620}); pg=ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(800)
    pg.click("[data-pick=marche]"); pg.wait_for_timeout(500)
    print("タブ:", pg.evaluate("()=>[...document.querySelectorAll('[data-cat]')].map(b=>b.textContent)"))
    print("すべての商品数:", pg.evaluate("()=>document.querySelectorAll('.pbtn').length"))
    pg.click("[data-cat='こもあん']"); pg.wait_for_timeout(300)
    print("こもあんの商品:", pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent)"))
    pg.screenshot(path="/tmp/reg_marche.png")
    # 祭りではタブが出ないこと
    pg.click("[data-go='top']"); pg.wait_for_timeout(300)
    pg.click("[data-pick=food]"); pg.wait_for_timeout(500)
    print("祭りのタブ数(0であること):", pg.evaluate("()=>document.querySelectorAll('[data-cat]').length"))
    b.close()
PY
```

Expected:
- タブ: `['すべて', 'レスポ', 'こもあん', 'こもれび', 'ベーカリー', 'B型']`
- すべての商品数: 28
- こもあんの商品: 7品（アクリルたわし2種・キーホルダー3種・ブローチ・ボタンかざり）
- 祭りのタブ数: 0

`/tmp/reg_marche.png` を Read ツールで開いて、タブと商品が崩れていないことを目視する。

- [ ] **Step 6: コミット**

```bash
git add src/ui/state.js src/ui/screen-register.js styles.css
git commit -m "feat: レジ画面にカテゴリータブを追加（祭りでは非表示）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 商品別シートにカテゴリー列／商品設定画面でカテゴリー入力

**Files:**
- Modify: `src/core/exportsheets.js`（`productSheet`）
- Modify: `src/ui/screen-products.js`（`add` と `edit`）
- Test: `tests/summary.test.js`（既存の productSheet テストを更新＋追加）

- [ ] **Step 1: 失敗するテストを書く**

`tests/summary.test.js` の既存テスト2件を書き換える。

まず `productSheet: 見出しは 商品名/単価/個数/売上/構成比` を探し、以下に置き換える:

```javascript
test('productSheet: 見出しは カテゴリー/商品名/単価/個数/売上/構成比(%)', () => {
  assert.deepEqual(productSheet(PSALES).rows[0], ['カテゴリー', '商品名', '単価', '個数', '売上', '構成比(%)']);
});
```

次に、末尾に追加:

```javascript

test('productSheet: 商品のカテゴリーが1列目に出る', () => {
  const sales = [{ status: 'active', terminal: 'marche', total: 100,
    items: [{ name: 'ブローチ', unit_price: 100, qty: 1, category: 'こもあん' }] }];
  const row = productSheet(sales).rows[1];
  assert.equal(row[0], 'こもあん');
  assert.equal(row[1], 'ブローチ');
});

test('productSheet: カテゴリーが無い商品（祭り）は空欄', () => {
  const sales = [{ status: 'active', terminal: 'food', total: 600,
    items: [{ name: '広島焼き', unit_price: 600, qty: 1 }] }];
  const row = productSheet(sales).rows[1];
  assert.equal(row[0], '');
  assert.equal(row[1], '広島焼き');
});

test('productSheet: 合計行もカテゴリー列の分ずれない', () => {
  const last = productSheet(PSALES).rows.at(-1);
  assert.equal(last[0], '');
  assert.equal(last[1], '合計');
  assert.equal(last[5], 100);
});
```

さらに、既存テストは列が1つ右にずれるので添字を直す。**以下は `tests/summary.test.js` の現在の行番号と、その行の置換後の姿**（左の数字は現状の行番号。実際の編集では文字列で一致させること）:

| 行 | 現在 | 置換後 |
|---|---|---|
| 124 | `const hiroshima = rows.find((r) => r[0] === '広島焼き');` | `const hiroshima = rows.find((r) => r[1] === '広島焼き');` |
| 125 | `assert.deepEqual(hiroshima.slice(0, 4), ['広島焼き', 600, 3, 1800]);` | `assert.deepEqual(hiroshima.slice(1, 5), ['広島焼き', 600, 3, 1800]);` |
| 130 | `assert.equal(rows.find((r) => r[0] === 'エビフライ（5個入り）'), undefined);` | `assert.equal(rows.find((r) => r[1] === 'エビフライ（5個入り）'), undefined);` |
| 135 | `const frank = rows.find((r) => r[0] === 'フランクフルト');` | `const frank = rows.find((r) => r[1] === 'フランクフルト');` |
| 136 | `assert.deepEqual(frank.slice(0, 4), ['フランクフルト', 450, 1, 450]);` | `assert.deepEqual(frank.slice(1, 5), ['フランクフルト', 450, 1, 450]);` |
| 141 | `const amounts = body.map((r) => r[3]);` | `const amounts = body.map((r) => r[4]);` |
| 149-152 | `assert.equal(last[0], '合計');` 〜 `assert.equal(last[4], 100);` | Step 1 で追加する「合計行もカテゴリー列の分ずれない」テストと重複するため、**この4行を `assert.equal(last[1], '合計');` `assert.equal(last[3], 5);` `assert.equal(last[4], 2550);` `assert.equal(last[5], 100);` に置き換える** |
| 159 | `const hiroshima = body.find((r) => r[0] === '広島焼き');` | `const hiroshima = body.find((r) => r[1] === '広島焼き');` |
| 160 | `assert.equal(hiroshima[4], 70.6);` | `assert.equal(hiroshima[5], 70.6);` |
| 162 | `assert.equal(Math.round(r[4] * 10) / 10, r[4], \`構成比が小数1桁でない: ${r[0]} ${r[4]}\`);` | `assert.equal(Math.round(r[5] * 10) / 10, r[5], \`構成比が小数1桁でない: ${r[1]} ${r[5]}\`);` |
| 168 | `const sum = body.reduce((s, r) => s + r[4], 0);` | `const sum = body.reduce((s, r) => s + r[5], 0);` |
| 178 | `const sum = body.reduce((s, r) => s + r[4], 0);` | `const sum = body.reduce((s, r) => s + r[5], 0);` |
| 179 | `assert.equal(Math.round(sum * 10) / 10, 100, \`構成比=${body.map((r) => r[4])} 合計=${sum}\`);` | `assert.equal(Math.round(sum * 10) / 10, 100, \`構成比=${body.map((r) => r[5])} 合計=${sum}\`);` |
| 186 | `assert.equal(Math.round(r[4] * 10) / 10, r[4], \`小数1桁でない: ${r[0]} ${r[4]}\`);` | `assert.equal(Math.round(r[5] * 10) / 10, r[5], \`小数1桁でない: ${r[1]} ${r[5]}\`);` |
| 187 | `const exact = (r[3] / total) * 100;` | `const exact = (r[4] / total) * 100;` |
| 188 | `assert.ok(Math.abs(r[4] - exact) <= 0.1 + 1e-9, \`${r[0]} 表示${r[4]} vs 実際${exact}\`);` | `assert.ok(Math.abs(r[5] - exact) <= 0.1 + 1e-9, \`${r[1]} 表示${r[5]} vs 実際${exact}\`);` |
| 204 | `const row = productSheet(mixed).rows.find((r) => r[0] === '冷やしパイン');` | `const row = productSheet(mixed).rows.find((r) => r[1] === '冷やしパイン');` |
| 205 | `assert.equal(row[1], '混在', '単価が混在する時は「混在」と出す');` | `assert.equal(row[2], '混在', '単価が混在する時は「混在」と出す');` |
| 206 | `assert.equal(row[2], 2);` | `assert.equal(row[3], 2);` |
| 207 | `assert.equal(row[3], 500);` | `assert.equal(row[4], 500);` |

また `productSheet: 最終行は合計（個数と売上の総和・構成比100）` 内の `const total = productSheet(PSALES).rows.at(-1)[3];`（構成比テスト内にある合計額の取得）は `[4]` に直す。

加えて「会計が0件でも見出しと合計行は出る」テストの期待値2つを次に置き換える:

```javascript
  assert.deepEqual(rows[0], ['カテゴリー', '商品名', '単価', '個数', '売上', '構成比(%)']);
  assert.deepEqual(rows[rows.length - 1], ['', '合計', '', 0, 0, 0]);
```

⚠️ **置換後に `npm test` を実行し、`fail 0` になるまで直すこと。** 添字の直し漏れがあれば失敗として現れる。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: FAIL（カテゴリー列が無い）

- [ ] **Step 3: productSheet を実装する**

`src/core/exportsheets.js` の `productSheet` を以下に置き換える（`percentShares` 関数はそのまま残す）:

```javascript
export function productSheet(sales) {
  const rows = [['カテゴリー', '商品名', '単価', '個数', '売上', '構成比(%)']];
  const map = new Map();
  for (const sale of sales) {
    if (sale.status !== 'active') continue;
    for (const item of sale.items) {
      const cur = map.get(item.name) ?? { name: item.name, category: item.category ?? '', qty: 0, amount: 0, prices: new Set() };
      cur.qty += item.qty;
      cur.amount += item.unit_price * item.qty;
      cur.prices.add(item.unit_price);
      if (!cur.category && item.category) cur.category = item.category;
      map.set(item.name, cur);
    }
  }
  const list = [...map.values()].sort((a, b) => b.amount - a.amount);
  const totalQty = list.reduce((sum, p) => sum + p.qty, 0);
  const totalAmount = list.reduce((sum, p) => sum + p.amount, 0);
  const shares = percentShares(list.map((p) => p.amount), totalAmount);
  list.forEach((p, i) => {
    rows.push([
      p.category,
      p.name,
      p.prices.size === 1 ? [...p.prices][0] : '混在',
      p.qty,
      p.amount,
      shares[i],
    ]);
  });
  rows.push(['', '合計', '', totalQty, totalAmount, totalAmount === 0 ? 0 : 100]);
  return { name: '商品別', rows };
}
```

- [ ] **Step 4: 会計にカテゴリーを持たせる**

`src/ui/screen-register.js` の `addItem` 関数を探し、`state.cart.push(...)` の行を以下に置き換える:

```javascript
    state.cart.push({ product_id: product.id, name: product.name, unit_price: product.price, qty: 1, category: product.category ?? '' });
```

⚠️ `src/core/sale.js` は触らない。`copyItems` がオブジェクトをそのままコピーするので `category` も保存される。

- [ ] **Step 5: 商品設定画面でカテゴリーを入力できるようにする**

`src/ui/screen-products.js` の `edit` 関数、`const price = parseInt(priceStr, 10);` の**前**に追加:

```javascript
  const category = prompt('分類（マルシェのカテゴリー。空欄なら分類なし）', p.category ?? '');
  if (category === null) return;
```

同関数の `p.price = price;` の直後に追加:

```javascript
  p.category = category.trim();
```

`add` 関数、`const price = parseInt(priceStr, 10);` の**前**に追加:

```javascript
  const category = prompt('分類（マルシェのカテゴリー。空欄なら分類なし）', '');
  if (category === null) return;
```

同関数の `state.products.push({` のオブジェクトに `category` を追加（`is_available: true,` の直前）:

```javascript
    category: category.trim(),
```

- [ ] **Step 6: テストを実行して通ることを確認**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`（157件）

- [ ] **Step 7: コミット**

```bash
git add src/core/exportsheets.js src/ui/screen-register.js src/ui/screen-products.js tests/summary.test.js
git commit -m "feat: 商品別シートにカテゴリー列を追加・商品設定で分類を入力可能に

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 実ブラウザ検証スクリプト

**Files:**
- Create: `scripts/verify_marche.py`

- [ ] **Step 1: 検証スクリプトを書く**

`scripts/verify_marche.py` を新規作成:

```python
"""2026-09-25 マルシェ対応（イベント切替＋カテゴリータブ）の検証。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_marche.py

⚠️ 検証用の会計を作る。後片付けは作った会計のIDだけを消す。
   実売上の入った端末・ブラウザでは実行しないこと。
"""
import sys, zipfile, re, pathlib, tempfile
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
ok = True
def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg); ok = ok and cond

def read_sheets(path):
    z = zipfile.ZipFile(path)
    names = re.findall(r'<sheet name="([^"]+)"', z.read("xl/workbook.xml").decode())
    out = {}
    for i, nm in enumerate(names, start=1):
        xml = z.read(f"xl/worksheets/sheet{i}.xml").decode()
        rows = []
        for rm in re.finditer(r"<row[^>]*>(.*?)</row>", xml, re.S):
            cells = []
            for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', rm.group(1), re.S):
                ref, attrs, body = cm.groups()
                col = 0
                for ch in ref: col = col * 26 + (ord(ch) - 64)
                while len(cells) < col - 1: cells.append("")
                if 'inlineStr' in attrs:
                    t = re.search(r"<t[^>]*>(.*?)</t>", body, re.S)
                    cells.append(t.group(1) if t else "")
                else:
                    v = re.search(r"<v>(.*?)</v>", body, re.S)
                    cells.append(v.group(1) if v else "")
            rows.append(cells)
        out[nm] = rows
    return out

EXPECT_CATS = ["すべて", "レスポ", "こもあん", "こもれび", "ベーカリー", "B型"]

with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h) in [(1080, 620), (1024, 535)]:
        ctx = b.new_context(viewport={"width": w, "height": h}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(900)

        # --- トップがイベント選択になっている ---
        h1 = pg.evaluate("()=>document.querySelector('.top__lead h1').textContent.trim()")
        check(h1 == "どのイベントですか？", f"[{w}x{h}] トップの見出し={h1!r}")
        picks = pg.evaluate("()=>[...document.querySelectorAll('[data-pick]')].map(b=>b.dataset.pick)")
        check(picks == ["marche", "food", "drink"], f"[{w}x{h}] イベント={picks}")

        # --- マルシェ: カテゴリータブ ---
        pg.click("[data-pick=marche]"); pg.wait_for_timeout(600)
        tabs = pg.evaluate("()=>[...document.querySelectorAll('[data-cat]')].map(b=>b.textContent.trim())")
        check(tabs == EXPECT_CATS, f"[{w}x{h}] タブ={tabs}")
        n_all = pg.evaluate("()=>document.querySelectorAll('.pbtn').length")
        check(n_all == 28, f"[{w}x{h}] 「すべて」の商品数={n_all}（期待28）")

        # カテゴリーを選ぶと商品が入れ替わる
        pg.click("[data-cat='こもあん']"); pg.wait_for_timeout(300)
        names = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check(len(names) == 7, f"[{w}x{h}] こもあんの商品数={len(names)} {names}")
        check("ブローチ" in names and "ハロウィンチャーム" not in names,
              f"[{w}x{h}] こもあんの中身が正しい={names}")
        on = pg.evaluate("()=>[...document.querySelectorAll('[data-cat].is-on')].map(b=>b.textContent.trim())")
        check(on == ["こもあん"], f"[{w}x{h}] 選択中のタブ={on}")

        pg.click("[data-cat='B型']"); pg.wait_for_timeout(300)
        names = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check(sorted(names) == sorted(["魚魚", "こもだれ"]), f"[{w}x{h}] B型の商品={names}")

        # --- 会計を通す → 先頭タブに戻る ---
        pg.click(".pbtn"); pg.wait_for_timeout(150)
        pg.click("[data-cash='100']"); pg.wait_for_timeout(150)
        done = pg.evaluate("()=>document.querySelector('[data-done]').disabled")
        check(not done, f"[{w}x{h}] 支払い完了が押せる")
        pg.click("[data-done]"); pg.wait_for_timeout(700)
        on = pg.evaluate("()=>[...document.querySelectorAll('[data-cat].is-on')].map(b=>b.textContent.trim())")
        check(on == ["すべて"], f"[{w}x{h}] 会計後は先頭タブに戻る={on}")

        # --- 祭りに切り替えるとタブが出ない・データが無傷 ---
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        pg.click("[data-pick=food]"); pg.wait_for_timeout(700)
        check(pg.evaluate("()=>document.querySelectorAll('[data-cat]').length") == 0,
              f"[{w}x{h}] 祭りではカテゴリータブが出ない")
        fnames = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check("広島焼き" in fnames and len(fnames) == 5, f"[{w}x{h}] 祭りのフード5品が無傷={fnames}")
        funits = pg.evaluate("()=>[...document.querySelectorAll('[data-cash]')].map(b=>Number(b.dataset.cash))")
        check(funits == [50, 100, 500, 1000, 5000], f"[{w}x{h}] 祭りの金種が無傷={funits}")

        # --- マルシェに戻ると売上が残っている ---
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        meta = pg.evaluate("""()=>[...document.querySelectorAll('[data-pick]')].map(b=>
          ({id:b.dataset.pick, meta:b.querySelector('.pick__meta').textContent.trim()}))""")
        marche_meta = [m["meta"] for m in meta if m["id"] == "marche"][0]
        check("1組" in marche_meta, f"[{w}x{h}] トップにマルシェの売上が出る={marche_meta!r}")

        # --- Excel: カテゴリー列 ---
        pg.click("[data-pick=marche]"); pg.wait_for_timeout(500)
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        pg.click("[data-go='export']"); pg.wait_for_timeout(600)
        with pg.expect_download() as dl:
            pg.click("[data-xlsx]")
        path = pathlib.Path(tempfile.gettempdir()) / "verify_marche.xlsx"
        dl.value.save_as(str(path))
        sheets = read_sheets(path)
        prod = sheets["商品別"]
        check(prod[0] == ["カテゴリー", "商品名", "単価", "個数", "売上", "構成比(%)"],
              f"[{w}x{h}] 商品別の見出し={prod[0]}")
        check(prod[1][0] == "B型", f"[{w}x{h}] カテゴリー列に値が入る={prod[1]}")

        check(errs == [], f"[{w}x{h}] JSエラー={errs}")

        # --- 後片付け: 作った会計のIDだけ消す ---
        ids = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
          q.onsuccess=()=>res(q.result.map(s=>s.id))}})""")
        pg.evaluate("""(ids)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const tx=r.result.transaction('sales','readwrite');const st=tx.objectStore('sales');
          ids.forEach(i=>st.delete(i));tx.oncomplete=()=>res(1)}})""", ids)
        left = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').count();q.onsuccess=()=>res(q.result)}})""")
        check(left == 0, f"[{w}x{h}] 後片付け後の残件数={left}")
        ctx.close()
    b.close()

print("\n==== " + ("ALL OK" if ok else "FAILED") + " ====")
sys.exit(0 if ok else 1)
```

- [ ] **Step 2: 実行して全項目が通ることを確認**

Run: `python3 scripts/verify_marche.py`
Expected: `==== ALL OK ====`

失敗した項目があれば、その原因を実際に確認してから直す（テスト側を緩めない）。

- [ ] **Step 3: 既存の検証スクリプトを回帰として全通し**

```bash
python3 scripts/verify_cash500.py
python3 scripts/verify_product_sheet.py
python3 scripts/verify_prices_cash50.py
```

Expected: 3本とも `ALL OK` / NG 0件。

⚠️ `verify_prices_cash50.py` は祭りの商品・金種を検証するスクリプトなので、ここが落ちたら**祭りの機能を壊している**。必ず直す。

- [ ] **Step 4: コミット**

```bash
git add scripts/verify_marche.py
git commit -m "test: マルシェ対応の実ブラウザ検証スクリプト

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: バージョン更新とドキュメント

**Files:**
- Modify: `src/version.js`
- Modify: `sw.js:1`
- Modify: `相談_脳内整理/部下_プロトタイプ/23_夏祭りレジツール/CURRENT_STATE.md`

- [ ] **Step 1: バージョンとキャッシュ名を上げる**

`src/version.js`:

```javascript
export const BUILD = '2026-09-25 マルシェ対応';
```

`sw.js` の1行目:

```javascript
const CACHE = 'komoreji-pos-2026-09-25_marche';
```

- [ ] **Step 2: sw.js のキャッシュ対象に新ファイルを追加**

`sw.js` の `ASSETS` 配列、`'./src/core/cash.js',` の直後に追加:

```javascript
  './src/core/events.js',
```

⚠️ これを忘れるとオフライン時にイベント定義が読めずアプリが起動しない。

- [ ] **Step 3: 全テスト・全検証を通す**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
python3 scripts/verify_marche.py
python3 scripts/verify_cash500.py
python3 scripts/verify_product_sheet.py
python3 scripts/verify_prices_cash50.py
```

Expected: 単体 `fail 0`（157件）／検証4本とも ALL OK

- [ ] **Step 4: オフラインで起動するか確認**

```bash
python3 - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1080,"height":620}); pg=ctx.new_page()
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(2500)   # SWにキャッシュさせる
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_timeout(1500)
    print("オフラインでの見出し:", pg.evaluate("()=>document.querySelector('.top__lead h1')?.textContent ?? '(描画されない)'"))
    print("イベント:", pg.evaluate("()=>[...document.querySelectorAll('[data-pick]')].map(b=>b.dataset.pick)"))
    b.close()
PY
```

Expected: `どのイベントですか？` と `['marche', 'food', 'drink']`
（屋台・マルシェ会場はオフライン運用が前提なので、ここが動かないと本番で使えない）

- [ ] **Step 5: CURRENT_STATE.md を更新**

`相談_脳内整理/部下_プロトタイプ/23_夏祭りレジツール/CURRENT_STATE.md` の📍現在地の先頭ブロック（マルシェの項）を「設計完了・実装未着手」から実装済みの記述に書き換える。以下を必ず含める:
- 実装が完了し、ローカル検証まで通ったこと（単体157件・検証4本ALL OK）
- **価格は全品 暫定¥100** であること
- **確定後の差し替え手順**（`price` を直す→`PRODUCTS_SEED_VERSION` を上げる→`version.js`/`sw.js` も上げる→push→ホーム画面アプリ再起動2回）
- **当日の朝以降は seed version を上げない**こと

- [ ] **Step 6: コミット**

```bash
git add src/version.js sw.js "../../../Library/Mobile Documents/iCloud~md~obsidian/Documents/事業計画トータルフォルダ/相談_脳内整理/部下_プロトタイプ/23_夏祭りレジツール/CURRENT_STATE.md" 2>/dev/null || git add src/version.js sw.js
git commit -m "chore: マルシェ対応のバージョン更新（ver 2026-09-25 マルシェ対応）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

（CURRENT_STATE.md は別リポジトリ外のvaultにあるため、git add に失敗したら version.js と sw.js だけコミットしてよい）

---

## 完了後（このplanの外・Getterが実施）

1. **push前チェックリスト**（`03_Getter/00_オーケストレーション/rules/push-checklist.md`）を回す
   - ネイト精査（□4）・code-review（□7）は省略しない
2. オーナーに報告 → GO をもらってから push
3. **□9 本番確認**: 本番URLで ver 表示・マルシェのタブ・会計・Excel書き出しをE2Eで通す
4. オーナーから**価格が確定したら** Task 4 の商品データを更新し、`PRODUCTS_SEED_VERSION` を上げて再push

## 未確定（オーナー待ち）

- 各商品の価格（全品 暫定¥100 で実装済み・上記手順で差し替え）
- イベント名の正式表記（「マルシェ」で仮置き）
- 開催日
