export function cashierTotals(o: { lines: { price: number; quantity: number }[]; discount: number; vat: number; depositCredit?: number }) {
  const sub = o.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const net = Math.max(0, sub - o.discount);
  const tax = Math.round(net * o.vat / 100);
  const gross = net + tax;
  const deposit = Math.min(gross, Math.max(0, o.depositCredit ?? 0));
  return { sub, tax, gross, deposit, total: gross - deposit };
}
