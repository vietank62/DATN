import test from 'node:test';
import assert from 'node:assert/strict';
import { cashierTotals } from '../src/utils/cashierTotals.ts';
import { splitCashierOrder } from '../src/utils/splitCashierOrder.ts';
import { paymentReceiptHtml } from '../src/utils/paymentReceipt.ts';

const order = { lines: [{ id: 1, name: 'Món chính', price: 100000, quantity: 2 }], discount: 20000, vat: 8, depositCredit: 100000 };

test('deposit is deducted after discount and VAT, without reducing sales', () => {
  assert.deepEqual(cashierTotals(order), { sub: 200000, tax: 14400, gross: 194400, deposit: 100000, total: 94400 });
});

test('split bills conserve the deposit and never produce negative balances', () => {
  const { selected, remaining } = splitCashierOrder(order, { 1: 1 });
  assert.equal(selected.depositCredit, 97200);
  assert.equal(remaining.depositCredit, 2800);
  assert.equal(cashierTotals(selected).total, 0);
  assert.equal(cashierTotals(remaining).total, 94400);
});

test('receipt displays the deposit and the remaining payment', () => {
  const html = paymentReceiptHtml({ name: 'Nhà hàng' }, { ...order, id: 'bill1', table: 'A1', time: '2026-10-07T10:00:00Z', method: 'Tiền mặt', guests: 2, note: '' });
  assert.match(html, /Đã thanh toán đặt cọc/);
  assert.match(html, /Còn phải thanh toán/);
  assert.ok(html.includes((94400).toLocaleString('vi-VN')));
});
