import test from 'node:test';
import assert from 'node:assert/strict';
import { moveImage } from '../src/utils/moveImage.ts';
import { discountText, discountValue } from '../src/utils/discount.ts';
import { cashierPaymentMethod } from '../src/utils/cashierPaymentMethod.ts';

test('reordering gallery images preserves the original and all images', () => {
  const images = ['a', 'b', 'c'];
  assert.deepEqual(moveImage(images, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveImage(images, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(images, ['a', 'b', 'c']);
});

test('invalid image positions never reorder or remove images', () => {
  const images = ['a', 'b', 'c'];
  for (const [from, to] of [[-1, 0], [0, 3], [3, 0], [0, 0], [NaN, 1], [0, 1.5]]) {
    assert.equal(moveImage(images, from, to), images);
  }
});

test('voucher helpers preserve Vietnamese text, restaurant and discount amount', () => {
  const discount = { title: 'Ưu đãi', code: 'WELCOME10', kind: 'percent', value: 10,
    restaurant_name: 'Nhà hàng', minimum: 100000, expires_at: '2026-10-31T00:00:00Z' };
  assert.equal(discountValue(discount), '10%');
  const text = discountText(discount);
  assert.match(text, /WELCOME10/);
  assert.match(text, /Nhà hàng/);
  assert.match(text, /Giảm 10%/);
  assert.equal(discountValue({ ...discount, kind: 'amount', value: 20000 }), `${(20000).toLocaleString('vi-VN')}đ`);
});

test('cashier retains a valid selection while payment settings refetch', () => {
  assert.equal(cashierPaymentMethod({ context: 'bill1', value: 'Visa' }, 'bill1', ['Tiền mặt', 'Visa'], 'Tiền mặt'), 'Visa');
});

test('new payment context uses its own default instead of the previous bill method', () => {
  assert.equal(cashierPaymentMethod({ context: 'bill1', value: 'Visa' }, 'bill2', ['Tiền mặt', 'Visa'], 'Tiền mặt'), 'Tiền mặt');
});

test('removed or unavailable methods cannot remain selected', () => {
  assert.equal(cashierPaymentMethod({ context: 'bill1', value: 'Visa' }, 'bill1', ['Tiền mặt'], 'Tiền mặt'), 'Tiền mặt');
  assert.equal(cashierPaymentMethod(null, 'bill1', ['Visa'], 'Tiền mặt'), 'Visa');
  assert.equal(cashierPaymentMethod(null, 'bill1', [], 'Tiền mặt'), '');
});

test('an existing bill can keep its legacy method when explicitly allowed', () => {
  assert.equal(cashierPaymentMethod(null, 'bill1', ['Tiền mặt', 'ATM'], 'ATM'), 'ATM');
});
