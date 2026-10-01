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

test('DEFAULT_PRODUCTS: マルシェの商品が37品ある', () => {
  // 2026-09-28 一味シリーズを3種に分割＋ケチャップ追加で 28 → 31
  // 2026-10-01 レスポを実物に合わせて5品に・こもあんのブローチ/ボタンかざりを
  //            2種ずつに分割して 31 → 36（オーナーの手書きリストより）
  // 2026-10-01 こもれび価格受領。キーホルダー2種・編み物を廃止(-3)しシュシュ4種を追加(+4)で 36 → 37
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  assert.equal(marche.length, 37);
});

test('DEFAULT_PRODUCTS: マルシェに暫定¥100の商品が残っていない', () => {
  // 2026-10-01 全品の価格がオーナーから届いた。以後 ¥100 は「価格未確定の置き去り」の
  // サインなので、残っていたら落ちるようにして当日の金銭事故を防ぐ
  const left = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche' && p.price === 100);
  assert.deepEqual(left.map((p) => p.name), [], '価格未確定(¥100)の商品が残っている');
});

test('DEFAULT_PRODUCTS: ベーカリー4品の価格確定（2026-10-01 オーナー受領）', () => {
  const want = {
    'とんだバナナ１本 1,500円': 1500,
    'とんだバナナカット 330円': 330,
    'トマト&バジルのプリッツ 480円': 480,
    '晩白柚とピスタチオのビスコッティ 480円': 480,
  };
  const byName = Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.name, p.price]));
  for (const [name, price] of Object.entries(want)) {
    assert.equal(byName[name], price, `${name} の価格が違う`);
  }
});

test('DEFAULT_PRODUCTS: こもれびの価格確定8品（2026-10-01 オーナー受領）', () => {
  const want = {
    'シュシュ 450円': 450, 'シュシュ 400円': 400,
    'シュシュ 350円': 350, 'シュシュ 300円': 300,
    'みかんちゃん大 1,350円': 1350, 'みかんちゃん小 500円': 500,
    'ちゅるちゅるみかん 500円': 500, 'カレンダー 2,600円': 2600,
  };
  const byName = Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.name, p.price]));
  for (const [name, price] of Object.entries(want)) {
    assert.equal(byName[name], price, `${name} の価格が違う`);
  }
});

test('DEFAULT_PRODUCTS: 出品に無い3品はレジから消える（オーナー確認「無し」）', () => {
  // キーホルダー（紙粘土）/アクリルキーホルダー/編み物。
  // defaults から消すだけでは端末に残るので RETIRED_PRODUCT_IDS に入れる必要がある
  for (const id of ['m10', 'm11', 'm12']) {
    assert.ok(!DEFAULT_PRODUCTS.some((p) => p.id === id), `${id} が defaults に残っている`);
    assert.ok(RETIRED_PRODUCT_IDS.includes(id), `${id} が RETIRED_PRODUCT_IDS に無い`);
  }
});

test('DEFAULT_PRODUCTS: レスポは実物5品（手書きの名称どおり）', () => {
  const respo = DEFAULT_PRODUCTS.filter((p) => p.category === 'レスポ');
  assert.deepEqual(respo.map((p) => [p.name, p.price]), [
    ['ブレスレット 200円', 200],
    ['ブレスレット 400円', 400],
    ['チャーム 500円', 500],
    ['チャーム 600円', 600],
    ['チャーム・ブレスレット（花柄） 250円', 250],
  ]);
});

test('DEFAULT_PRODUCTS: 同名で価格違いの商品は名前の金額で見分けられる', () => {
  // ブローチ・ボタンかざり・ブレスレット・チャームは2種ずつある。
  // 職員がレジで取り違えないよう、名前に金額を入れている（2026-10-01 オーナー指示）
  const marche = DEFAULT_PRODUCTS.filter((p) => p.terminal === 'marche');
  const names = marche.map((p) => p.name);
  assert.equal(new Set(names).size, names.length, '同じ名前の商品が2つある');
  for (const p of marche) {
    if (p.price === 100) continue;   // 価格未確定の暫定品は対象外
    const inName = p.name.replace(/,/g, '').match(/(\d+)円$/);
    if (inName) {
      assert.equal(Number(inName[1]), p.price, `${p.name} の名前の金額と価格が食い違う`);
    }
  }
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
  assert.ok(names.some((n) => n.startsWith('アクリルたわし（スマイル')));
  assert.ok(names.some((n) => n.startsWith('アクリルたわし（くま')));
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
  assert.deepEqual(orders, [...Array(marche.length).keys()], '欠番や重複があるとタブ順が崩れる');
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

test('mergeDefaultProducts: カテゴリーの変更も端末に反映される', () => {
  // 2026-09-28 code-review指摘: category が反映対象から漏れていた。
  // カテゴリーを組み替えた時、既に開いた端末だけ旧カテゴリーのまま残り
  // 「商品がタブから消えた」ように見える事故になる。
  const stored = [{ id: 'm1', terminal: 'marche', name: '旧名', price: 100, category: '旧分類', sort_order: 3, is_available: false }];
  const defaults = [{ id: 'm1', terminal: 'marche', name: '新名', price: 680, category: '新分類', sort_order: 0, is_available: true }];
  const r = mergeDefaultProducts(stored, defaults);
  assert.equal(r[0].category, '新分類');
  assert.equal(r[0].name, '新名');
  assert.equal(r[0].price, 680);
  assert.equal(r[0].is_available, false, '品切れ状態は運用実績なので保持する');
  assert.equal(r[0].sort_order, 3, '並び替え結果は保持する');
});

// --- 商品ボタンの価格表示（2026-10-01 オーナー指示「名前だけに金額」） ---
import { showsPriceLine } from '../src/core/products.js';

test('showsPriceLine: 名前の末尾に金額が入っていれば下の価格行は出さない', () => {
  assert.equal(showsPriceLine({ name: 'ブローチ 1,100円', price: 1100 }), false);
  assert.equal(showsPriceLine({ name: 'ブレスレット 200円', price: 200 }), false);
});

test('showsPriceLine: 名前に金額が無ければ下に価格を出す（祭りの商品）', () => {
  assert.equal(showsPriceLine({ name: '広島焼き', price: 600 }), true);
  assert.equal(showsPriceLine({ name: 'キーホルダー（紙粘土）', price: 100 }), true);
});

test('showsPriceLine: 商品名に数字が入っていても「円」で終わらなければ出す', () => {
  assert.equal(showsPriceLine({ name: 'とんだバナナ１本', price: 100 }), true);
  assert.equal(showsPriceLine({ name: 'エビフライ（5個入り）', price: 650 }), true);
});

// --- 廃止した商品の削除（2026-10-01 レスポ入れ替えで必要になった） ---
import { RETIRED_PRODUCT_IDS } from '../src/core/products.js';

test('mergeDefaultProducts: 廃止した商品は端末から消える', () => {
  const stored = [
    { id: 'm01', terminal: 'marche', name: 'ハロウィンチャーム', price: 100, category: 'レスポ', sort_order: 0, is_available: true },
    { id: 'u1', terminal: 'marche', name: '現場で足した商品', price: 300, category: 'レスポ', sort_order: 99, is_available: true },
  ];
  const defaults = [{ id: 'm37', terminal: 'marche', name: 'ブレスレット 200円', price: 200, category: 'レスポ', sort_order: 0, is_available: true }];
  const r = mergeDefaultProducts(stored, defaults, ['m01']);
  assert.deepEqual(r.map((p) => p.id), ['m37', 'u1'], '廃止したm01だけが消え、現場で足した商品は残る');
});

test('mergeDefaultProducts: 廃止リストを渡さなければ従来どおり', () => {
  const stored = [{ id: 'x', terminal: 'marche', name: '独自', price: 100, sort_order: 0, is_available: true }];
  const r = mergeDefaultProducts(stored, []);
  assert.deepEqual(r.map((p) => p.id), ['x']);
});

test('RETIRED_PRODUCT_IDS: 現行のDEFAULT_PRODUCTSと重複しない', () => {
  // 廃止したidを現役商品に使い回すと、品切れ状態を引き継いで画面に出なくなる
  const live = new Set(DEFAULT_PRODUCTS.map((p) => p.id));
  for (const id of RETIRED_PRODUCT_IDS) {
    assert.ok(!live.has(id), `${id} は廃止リストにあるのに現行商品にも存在する`);
  }
});

import { PRODUCTS_SEED_VERSION } from '../src/core/products.js';

// --- 反映漏れを機械で止める（2026-10-01 ネイト指摘） ---
// 商品を直したのに version.js / sw.js の CACHE 名を上げ忘れると、
// 現場で「ver が最新か」を見ても旧版と区別できず ¥100 のまま売ってしまう。
// seed version と BUILD / CACHE の「日付以降の区別子」が揃っているかを見る。
test('PRODUCTS_SEED_VERSION と version.js / sw.js の CACHE 名が揃っている', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const root = new URL('../', import.meta.url);
  const build = fs.readFileSync(url.fileURLToPath(new URL('src/version.js', root)), 'utf8');
  const sw = fs.readFileSync(url.fileURLToPath(new URL('sw.js', root)), 'utf8');

  // seed: '2026-10-01-komorebi' → 日付 '2026-10-01' と 区別子 'komorebi'
  const m = PRODUCTS_SEED_VERSION.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  assert.ok(m, `PRODUCTS_SEED_VERSION が「日付-区別子」の形でない: ${PRODUCTS_SEED_VERSION}`);
  const [, date, tag] = m;

  const buildLine = build.match(/BUILD = '([^']+)'/)?.[1] ?? '';
  assert.ok(buildLine.includes(date),
    `version.js の BUILD に seed の日付 ${date} が入っていない（実際: ${buildLine}）`);

  const cache = sw.match(/CACHE = '([^']+)'/)?.[1] ?? '';
  assert.ok(cache.includes(date),
    `sw.js の CACHE に seed の日付 ${date} が入っていない（実際: ${cache}）`);

  // 区別子そのものの一致までは求めない。価格を変えない修正（コードだけの直し）でも
  // CACHE と BUILD は上げる必要があり、その時 seed の区別子は据え置くのが正しいため。
  // 「同じ日に2回出す時、前回と違う名前になっているか」は push 前に
  //   git show origin/main:sw.js | grep CACHE
  // で突合する（当日の手順書にも記載）。
  assert.ok(/[a-z0-9_]+$/.test(cache),
    `sw.js の CACHE 名が「日付＋区別子」の形でない（実際: ${cache}）`);
  assert.ok(buildLine !== '2026-10-01 商品登録',
    'BUILD が過去のリリース名のまま。商品やコードを直したら必ず上げること');
});
