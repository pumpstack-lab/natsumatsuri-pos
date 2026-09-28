// Excel書き出し用のシートデータ生成（純粋関数）。
// 列構成はCSVと同一（既存のExcel合算テンプレートにそのまま貼れる）。
const TERMINAL_LABEL = { food: 'フード', drink: 'ドリンク' };
const STATUS_LABEL = { active: '有効', voided: '取消' };
const PAYMENT_LABEL = { cash: '現金', paypay: 'PayPay', unpaid: '未納' };

function localTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function detailSheet(sales) {
  const rows = [[
    '会計ID', '顧客番号', '窓口', '商品名', '単価', '個数', '小計',
    '会計合計', '預かり', 'お釣り', '状態', '登録時刻', '商品券', '支払い', '職員名',
  ]];
  for (const s of sales) {
    for (const item of s.items) {
      rows.push([
        s.id, s.seq, TERMINAL_LABEL[s.terminal] ?? s.terminal,
        item.name, item.unit_price, item.qty, item.unit_price * item.qty,
        s.total, s.received ?? '', s.change ?? '',
        STATUS_LABEL[s.status] ?? s.status, localTime(s.created_at),
        (s.vouchers ?? 0) > 0 ? s.vouchers : '',
        PAYMENT_LABEL[s.payment ?? 'cash'],
        s.staffName ?? '',
      ]);
    }
  }
  return { name: '明細', rows };
}

export function summarySheet(sales) {
  const rows = [[
    '顧客番号', '窓口', '商品内訳', '合計', '預かり', 'お釣り', '状態', '登録時刻', '商品券', '支払い', '職員名',
  ]];
  for (const s of sales) {
    rows.push([
      s.seq, TERMINAL_LABEL[s.terminal] ?? s.terminal,
      s.items.map((i) => `${i.name}×${i.qty}`).join(' '),
      s.total, s.received ?? '', s.change ?? '',
      STATUS_LABEL[s.status] ?? s.status, localTime(s.created_at),
      (s.vouchers ?? 0) > 0 ? s.vouchers : '',
      PAYMENT_LABEL[s.payment ?? 'cash'],
      s.staffName ?? '',
    ]);
  }
  return { name: 'サマリー', rows };
}

// 構成比（％・小数1桁）を、足すとちょうど100になるように配分する（最大剰余法）。
// 単純に四捨五入すると 33.3+33.3+33.3=99.9 のようにズレ、
// オーナーが検算した時に合計行の100と食い違って見える。
// 端数は「切り捨てで損した分が大きい商品」から順に0.1ずつ配る。
function percentShares(amounts, total) {
  if (total === 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (a / total) * 1000);   // 0.1%単位で扱う
  const floor = exact.map((x) => Math.floor(x));
  let rest = 1000 - floor.reduce((s, x) => s + x, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floor];
  for (let k = 0; k < order.length && rest > 0; k++, rest--) out[order[k].i] += 1;
  return out.map((x) => x / 10);
}

// 商品ごとの売上集計シート（2026-09-24 オーナー要望）。
// 画面の「商品別集計」タブと同じ範囲＝取消は除外・職員販売は含む・売上の大きい順。
// ⚠️ ここでいう「売上」は職員販売（未納・PayPay含む）も足した金額＝「出た個数」の話であって
//    「現金化した売上」ではない。将来これを原価計算・仕入れ判断に転用するなら、
//    未納を分けた定義を別に作ること（同じ数字を流用すると仕入れ量を読み違える）。
// 単価は同一商品で単価が混ざっている時（祭りの途中で値段を変えた等）は
// どれか1つを書くと金額を取り違えるため「混在」と入れる
// （空欄だと現場に「バグでは」と誤解されるため・2026-09-24 ネイト指摘）。
// 構成比は「38.2」のようにパーセントの数値そのものを入れる。
// この xlsx 生成には書式(styles.xml)が無く、0.382 で出すとExcelに
// 「0.382」と表示されて読めないため（書式対応は既存シートを壊すので入れない）。
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

export function xlsxFileName(terminal, date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `komoreji_${terminal}_${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.xlsx`;
}
