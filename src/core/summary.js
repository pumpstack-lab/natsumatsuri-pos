function activeOnly(sales) {
  return sales.filter((s) => s.status === 'active');
}

export function summarize(sales) {
  const active = activeOnly(sales);
  const totalSales = active.reduce((sum, s) => sum + s.total, 0);
  const count = active.length;
  const average = count === 0 ? 0 : Math.round(totalSales / count);
  return { totalSales, count, average };
}

export function productBreakdown(sales) {
  const map = new Map();
  for (const sale of activeOnly(sales)) {
    for (const item of sale.items) {
      const key = item.name;
      const cur = map.get(key) ?? { name: key, qty: 0, amount: 0 };
      cur.qty += item.qty;
      cur.amount += item.unit_price * item.qty;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
