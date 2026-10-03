// 診断記録の入れ物（画面やブラウザに依存しない部分）。
// 現場で「固まった」時に、直前に何が起きていたかを後から見るために使う。
// 1会計で約10件たまる。固まった時刻の記録が、開き直したあとの会計で押し出されないよう多めに持つ。
export const DIAG_MAX = 2000;

export function appendEntry(list, entry, max = DIAG_MAX) {
  const base = Array.isArray(list) ? list : [];
  const next = [...base, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}
