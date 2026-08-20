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

export function xlsxFileName(terminal, date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `natsumatsuri_${terminal}_${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.xlsx`;
}
