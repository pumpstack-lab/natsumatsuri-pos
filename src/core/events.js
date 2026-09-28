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
