export const DEFAULT_PRODUCTS = [
  // 価格はすべて仮です。当日の実売価格に「商品の設定」画面から変更してください。
  { id: 'f1', terminal: 'food', name: '冷やしパイン', price: 300, sort_order: 0, is_available: true },
  { id: 'f2', terminal: 'food', name: '焼きそば', price: 500, sort_order: 1, is_available: true },
  { id: 'f3', terminal: 'food', name: 'エビフライ', price: 300, sort_order: 2, is_available: true },
  { id: 'f4', terminal: 'food', name: 'フランクフルト', price: 300, sort_order: 3, is_available: true },
  { id: 'f5', terminal: 'food', name: 'サイコロステーキ&ポテト', price: 600, sort_order: 4, is_available: true },

  { id: 'd1', terminal: 'drink', name: 'キリン一番搾り', price: 500, sort_order: 0, is_available: true },
  { id: 'd2', terminal: 'drink', name: 'アサヒスーパードライ', price: 500, sort_order: 1, is_available: true },
  { id: 'd3', terminal: 'drink', name: 'レモンサワー', price: 400, sort_order: 2, is_available: true },
  { id: 'd4', terminal: 'drink', name: 'ラムネ', price: 200, sort_order: 3, is_available: true },
  { id: 'd5', terminal: 'drink', name: 'やかんの麦茶', price: 150, sort_order: 4, is_available: true },
  { id: 'd6', terminal: 'drink', name: 'オレンジ', price: 150, sort_order: 5, is_available: true },
  { id: 'd7', terminal: 'drink', name: 'コーラ', price: 150, sort_order: 6, is_available: true },
  { id: 'd8', terminal: 'drink', name: 'キラキラ カルピス', price: 500, sort_order: 7, is_available: true },
  { id: 'd9', terminal: 'drink', name: 'キラキラ メロン', price: 500, sort_order: 8, is_available: true },
  { id: 'd10', terminal: 'drink', name: 'キラキラ おかわり', price: 200, sort_order: 9, is_available: true },
];

export function availableProducts(products, terminal) {
  return products
    .filter((p) => p.terminal === terminal && p.is_available)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function reorderProducts(products, orderedIds) {
  return products.map((p) => {
    const idx = orderedIds.indexOf(p.id);
    return idx === -1 ? p : { ...p, sort_order: idx };
  });
}
