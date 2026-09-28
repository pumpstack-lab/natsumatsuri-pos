export const DEFAULT_PRODUCTS = [
  // --- マルシェ（2026-09-25 オーナー受領の28品）---
  // ⚠️ ¥100 のものはまだ価格が未確定の暫定値。確定したら price を書き換えて PRODUCTS_SEED_VERSION を上げる
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
  { id: 'm15', terminal: 'marche', name: 'すだち×はちみつシロップ', price: 800, category: 'こもれび', sort_order: 14, is_available: true },
  { id: 'm16', terminal: 'marche', name: 'ススメご飯', price: 720, category: 'こもれび', sort_order: 15, is_available: true },
  { id: 'm17', terminal: 'marche', name: 'ちゅるちゅるみかん', price: 100, category: 'こもれび', sort_order: 16, is_available: true },
  { id: 'm18', terminal: 'marche', name: 'ノンオイルドレッシング', price: 720, category: 'こもれび', sort_order: 17, is_available: true },
  { id: 'm19', terminal: 'marche', name: 'おい！ポン酢', price: 720, category: 'こもれび', sort_order: 18, is_available: true },
  { id: 'm20', terminal: 'marche', name: 'すだちポン酢', price: 720, category: 'こもれび', sort_order: 19, is_available: true },
  { id: 'm21', terminal: 'marche', name: '一味KAN', price: 680, category: 'こもれび', sort_order: 20, is_available: true },
  { id: 'm29', terminal: 'marche', name: 'すだちの一撃', price: 680, category: 'こもれび', sort_order: 21, is_available: true },
  { id: 'm30', terminal: 'marche', name: 'ひ〜の用心', price: 680, category: 'こもれび', sort_order: 22, is_available: true },
  { id: 'm31', terminal: 'marche', name: 'ケチャップ', price: 680, category: 'こもれび', sort_order: 23, is_available: true },
  { id: 'm22', terminal: 'marche', name: 'カレンダー', price: 100, category: 'こもれび', sort_order: 24, is_available: true },
  { id: 'm23', terminal: 'marche', name: 'とんだバナナ１本', price: 100, category: 'ベーカリー', sort_order: 25, is_available: true },
  { id: 'm24', terminal: 'marche', name: 'とんだバナナカット', price: 100, category: 'ベーカリー', sort_order: 26, is_available: true },
  { id: 'm25', terminal: 'marche', name: 'トマト&バジルのプリッツ', price: 100, category: 'ベーカリー', sort_order: 27, is_available: true },
  { id: 'm26', terminal: 'marche', name: '晩白柚とピスタチオのビスコッティ', price: 100, category: 'ベーカリー', sort_order: 28, is_available: true },
  { id: 'm27', terminal: 'marche', name: '魚魚', price: 750, category: 'B型', sort_order: 29, is_available: true },
  { id: 'm28', terminal: 'marche', name: 'こもだれ', price: 680, category: 'B型', sort_order: 30, is_available: true },

  // 2026-09-16 行事計画書の実価格です。
  { id: 'f1', terminal: 'food', name: '冷やしパイン', price: 300, sort_order: 0, is_available: true },
  { id: 'f2', terminal: 'food', name: '広島焼き', price: 600, sort_order: 1, is_available: true },
  { id: 'f3', terminal: 'food', name: 'エビフライ（5個入り）', price: 650, sort_order: 2, is_available: true },
  { id: 'f4', terminal: 'food', name: 'フランクフルト', price: 450, sort_order: 3, is_available: true },
  { id: 'f5', terminal: 'food', name: 'サイコロステーキ&ポテト', price: 1000, sort_order: 4, is_available: true },

  { id: 'd1', terminal: 'drink', name: 'キリン一番搾り', price: 500, sort_order: 0, is_available: true },
  { id: 'd2', terminal: 'drink', name: 'アサヒスーパードライ', price: 500, sort_order: 1, is_available: true },
  { id: 'd3', terminal: 'drink', name: 'こだわり酒場のレモンサワー', price: 500, sort_order: 2, is_available: true },
  { id: 'd4', terminal: 'drink', name: 'ラムネ（瓶）', price: 200, sort_order: 3, is_available: true },
  { id: 'd5', terminal: 'drink', name: 'やかんの麦茶', price: 200, sort_order: 4, is_available: true },
  { id: 'd6', terminal: 'drink', name: 'オレンジ', price: 200, sort_order: 5, is_available: true },
  { id: 'd7', terminal: 'drink', name: 'コーラ', price: 200, sort_order: 6, is_available: true },
  { id: 'd8', terminal: 'drink', name: 'キラキラ カルピス', price: 500, sort_order: 7, is_available: true },
  { id: 'd9', terminal: 'drink', name: 'キラキラ メロン', price: 500, sort_order: 8, is_available: true },
  { id: 'd10', terminal: 'drink', name: 'キラキラ おかわり', price: 250, sort_order: 9, is_available: true },
];

export const PRODUCTS_SEED_VERSION = '2026-09-28-prices';

// stored（IndexedDBの現在値）に defaults の最新の名前・価格・terminal を反映する。
// is_available（品切れ状態）と sort_order（並び替え結果）は運用中の実績なので保持する。
// stored にしかない商品（ユーザーが独自追加したもの）はそのまま残す。
export function mergeDefaultProducts(stored, defaults) {
  const storedById = new Map(stored.map((p) => [p.id, p]));
  const merged = defaults.map((d) => {
    const existing = storedById.get(d.id);
    if (!existing) return { ...d };
    return {
      ...existing,
      name: d.name,
      price: d.price,
      terminal: d.terminal,
    };
  });
  const defaultIds = new Set(defaults.map((d) => d.id));
  const userAdded = stored.filter((p) => !defaultIds.has(p.id)).map((p) => ({ ...p }));
  return [...merged, ...userAdded];
}

export function availableProducts(products, terminal) {
  return products
    .filter((p) => p.terminal === terminal && p.is_available)
    .sort((a, b) => a.sort_order - b.sort_order);
}

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

// 商品グリッドの列数を商品数で決める。
// 2026-09-28: 13品以上を5列にする案を実測して撤回した。ボタンが小さくなった分
// グリッドが縮み、その高さを伝票エリアが取って**祭りの画面で支払い完了ボタンが
// 13〜14px はみ出した**（変更前は -5px で収まっていた）。
// 商品が多いカテゴリーはスクロールで対応し、下に続きがあることは
// 「↓ あとN品」の表示で知らせる（オーナー指示）。
export function gridDensity(count) {
  if (count >= 7) return 'reg__grid--dense';
  return '';
}

// 商品グリッドの下に隠れている品数。「あと○品」の表示に使う。
// 2026-09-28 オーナー要望「スクロール先にも商品があると分かるUIにしてほしい」。
export function hiddenBelowCount({ total, visible }) {
  return Math.max(0, total - visible);
}

// 選択中のカテゴリーで商品を絞る。ALL_CATEGORY / 未指定なら絞らない。
export function filterByCategory(products, category) {
  if (!category || category === ALL_CATEGORY) return products;
  return products.filter((p) => p.category === category);
}

export function reorderProducts(products, orderedIds) {
  return products.map((p) => {
    const idx = orderedIds.indexOf(p.id);
    return idx === -1 ? p : { ...p, sort_order: idx };
  });
}
