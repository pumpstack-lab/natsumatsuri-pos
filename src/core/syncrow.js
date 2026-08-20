// 同期用の行変換（純粋関数・Supabaseの列名との対応はここだけ）
export function toRow(sale) {
  return {
    id: sale.id,
    terminal: sale.terminal,
    seq: sale.seq,
    items: sale.items,
    total: sale.total,
    received: sale.received ?? null,
    change: sale.change ?? null,
    vouchers: sale.vouchers ?? 0,
    staff_name: sale.staffName ?? null,
    payment: sale.payment ?? 'cash',
    status: sale.status,
    edited: !!sale.edited,
    created_at: sale.created_at,
    updated_at: sale.updated_at,
  };
}

export function fromRow(r) {
  return {
    id: r.id, terminal: r.terminal, seq: r.seq, items: r.items, total: r.total,
    received: r.received, change: r.change, vouchers: r.vouchers ?? 0,
    staffName: r.staff_name ?? null, payment: r.payment ?? 'cash',
    status: r.status, edited: r.edited, created_at: r.created_at, updated_at: r.updated_at,
  };
}
