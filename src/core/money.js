export function lineSubtotal(unitPrice, qty) {
  return unitPrice * qty;
}

export function cartTotal(items) {
  return items.reduce((sum, item) => sum + lineSubtotal(item.unit_price, item.qty), 0);
}

export function calcChange(total, received) {
  if (total <= 0) {
    return { change: null, shortage: 0, canComplete: false };
  }
  if (received === null || received === undefined) {
    return { change: null, shortage: 0, canComplete: true };
  }
  if (received < total) {
    return { change: 0, shortage: total - received, canComplete: false };
  }
  return { change: received - total, shortage: 0, canComplete: true };
}
