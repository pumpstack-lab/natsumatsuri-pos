// HTMLに値を差し込む前のエスケープ。
// 商品名は設定画面から自由入力できるため、< > & " ' が入ってもレイアウトや
// 属性値（data-add="..." 等）が壊れないようにする。
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
