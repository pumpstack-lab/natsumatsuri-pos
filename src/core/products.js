export const DEFAULT_PRODUCTS = [
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

export const PRODUCTS_SEED_VERSION = '2026-09-16';

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
