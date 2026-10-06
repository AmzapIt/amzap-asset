import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseLicense, parseLicenseAssignment, encryptProductKey, decryptProductKey } from '../lib/license-inventory.js';
import { parseConsumable, parseConsumableMovement } from '../lib/consumable-inventory.js';
import { inventoryId, inventoryRequestId } from '../lib/inventory-core.js';

test('License input accepts bounded seats and expiry dates', () => {
  const value = parseLicense({ name: ' Office 365 ', total_seats: '12', purchase_date: '2026-01-01',
    expiration_date: '2027-01-01', purchase_cost: '1200.50', is_active: true });
  assert.equal(value.name, 'Office 365');
  assert.equal(value.totalSeats, 12);
  assert.equal(value.purchaseCost, '1200.50');
  for (const bad of [0, -1, 100001, '1.5', 'abc']) {
    assert.throws(() => parseLicense({ name: 'Office', total_seats: bad }), { status: 400 });
  }
  assert.throws(() => parseLicense({ name: 'Office', total_seats: 1,
    purchase_date: '2026-10-01', expiration_date: '2026-09-01' }), { status: 400 });
  assert.throws(() => parseLicense({ name: 'Office', total_seats: 1, is_active: 'false' }), { status: 400 });
});

test('License assignment requires one valid target', () => {
  assert.equal(parseLicenseAssignment({ target_type: 'user', target_id: '21', assigned_date: '2024-01-01' }).targetId, '21');
  assert.throws(() => parseLicenseAssignment({ target_type: 'department', target_id: '21' }), { status: 400 });
  assert.throws(() => parseLicenseAssignment({ target_type: 'asset', target_id: '0' }), { status: 400 });
});

test('Product Key is encrypted and authenticated', () => {
  const previous = process.env.LICENSE_ENCRYPTION_KEY;
  process.env.LICENSE_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
  try {
    const first = encryptProductKey('ABCD-EFGH-1234');
    const second = encryptProductKey('ABCD-EFGH-1234');
    assert.notEqual(first.encrypted, second.encrypted);
    assert.equal(first.hint, '1234');
    assert.equal(decryptProductKey(first.encrypted), 'ABCD-EFGH-1234');
    const parts = first.encrypted.split(':');
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
    const altered = parts.join(':');
    assert.throws(() => decryptProductKey(altered));
  } finally {
    if (previous === undefined) delete process.env.LICENSE_ENCRYPTION_KEY;
    else process.env.LICENSE_ENCRYPTION_KEY = previous;
  }
});

test('Consumables distinguish received stock, issue, and counted balance', () => {
  const item = parseConsumable({ name: ' Toner ', min_quantity: '2', unit: 'กล่อง', is_active: true });
  assert.equal(item.name, 'Toner');
  assert.equal(item.minQuantity, 2);
  assert.equal(parseConsumableMovement({ action: 'issue', quantity: '3', user_id: '8', reason: 'ใช้ในงาน', event_date: '2024-01-01' }).quantity, 3);
  assert.equal(parseConsumableMovement({ action: 'adjust', new_quantity: '0', reason: 'ตรวจนับ', event_date: '2024-01-01' }).newQuantity, 0);
  assert.throws(() => parseConsumableMovement({ action: 'return', quantity: 1, reason: 'คืน' }), { status: 400 });
  assert.throws(() => parseConsumableMovement({ action: 'issue', quantity: 1, user_id: '0', reason: 'ใช้' }), { status: 400 });
});

test('IDs and operation keys reject invalid values', () => {
  assert.equal(inventoryId('123'), '123');
  for (const id of ['0', '-1', '9223372036854775808', '1 OR 1=1']) {
    assert.throws(() => inventoryId(id), { status: 400 });
  }
  assert.equal(inventoryRequestId(randomUUID()).length, 36);
  assert.throws(() => inventoryRequestId('bad'), { status: 400 });
});
