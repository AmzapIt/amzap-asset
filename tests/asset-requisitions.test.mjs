import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequisition, listRequisitions, getRequisition } from '../lib/asset-requisitions.js';

const valid = () => ({ requestId: 'aabbccdd-1234-4567-89ab-123456789012', userId: '54',
  requestedDate: '2026-10-05', kind: 'additional', reason: ' ใช้ทำงานเพิ่ม ', itStaffName: ' IT Staff ',
  items: [{ name: ' Monitor ', quantity: 1, details: ' 24 นิ้ว ', returnedAssetId: '54', replacementAssetId: '55' }] });

test('normalizes an additional request and ignores stale Asset selections', () => {
  const input = parseRequisition(valid());
  assert.equal(input.reason, 'ใช้ทำงานเพิ่ม');
  assert.equal(input.itStaffName, 'IT Staff');
  assert.deepEqual(input.items, [{ name: 'Monitor', quantity: 1, details: '24 นิ้ว', returnedAssetId: null, replacementAssetId: null }]);
});

test('replacement requires distinct valid returned and replacement Asset IDs', () => {
  const body = { ...valid(), kind: 'replacement' };
  assert.equal(parseRequisition(body).items[0].returnedAssetId, '54');
  for (const field of ['returnedAssetId', 'replacementAssetId']) {
    const original = body.items[0][field];
    for (const value of ['', null, 'not-an-id', '9223372036854775808']) {
      body.items[0][field] = value;
      assert.throws(() => parseRequisition(body), { status: 400 });
    }
    body.items[0][field] = original;
  }
  body.items[0].replacementAssetId = body.items[0].returnedAssetId;
  assert.throws(() => parseRequisition(body), { status: 400 });
  body.items[0].replacementAssetId = '55';
  body.items[0].quantity = 2;
  assert.throws(() => parseRequisition(body), { status: 400 });
  assert.throws(() => parseRequisition({ ...valid(), itStaffName: ' ' }), { status: 400 });
});

test('rejects invalid body, employee, UUID, dates, kind and reason', () => {
  for (const bad of [null, [], 'text', {},
    { ...valid(), userId: '0' }, { ...valid(), userId: '9223372036854775808' },
    { ...valid(), requestId: 'bad' }, { ...valid(), kind: 'issue' },
    { ...valid(), requestedDate: '2026-02-29' }, { ...valid(), requestedDate: '2026-04-31' },
    { ...valid(), requestedDate: '2026-13-01' }, { ...valid(), requestedDate: '01/10/2026' },
    { ...valid(), reason: ' ' }, { ...valid(), reason: 'x'.repeat(2001) }]) {
    assert.throws(() => parseRequisition(bad), { status: 400 });
  }
  assert.equal(parseRequisition({ ...valid(), requestedDate: '2024-02-29' }).requestedDate, '2024-02-29');
});

test('requires 1–20 named items with bounded integer quantities and text', () => {
  for (const items of [[], Array(21).fill(valid().items[0]), [null],
    [{ name: ' ', quantity: 1 }], [{ name: 'x'.repeat(201), quantity: 1 }],
    [{ name: 'Monitor', quantity: 1, details: 'x'.repeat(501) }],
    ...[0, -1, 1.5, 1000, '1', NaN, Infinity, null].map((quantity) => [{ name: 'Monitor', quantity }])]) {
    assert.throws(() => parseRequisition({ ...valid(), items }), { status: 400 });
  }
});

test('history uses parameterized literal search and pagination without mutation', async () => {
  const db = { query: async (sql, values) => {
    assert.match(sql, /ORDER BY id DESC LIMIT 51 OFFSET \$3/);
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
    assert.deepEqual(values, ['replacement', '%A\\%\\_\\\\%', 50]);
    return { rows: Array.from({ length: 51 }, (_, i) => ({ id: String(i) })) };
  } };
  const result = await listRequisitions({ search: 'A%_\\', kind: 'replacement', page: 2 }, db);
  assert.equal(result.rows.length, 50);
  assert.equal(result.hasNext, true);
  await assert.rejects(listRequisitions({ page: -1 }, db), { status: 400 });
  await assert.rejects(listRequisitions({ kind: 'issued' }, db), { status: 400 });
});

test('document lookup validates IDs and reports a missing record', async () => {
  await assert.rejects(getRequisition('no'), { status: 400 });
  await assert.rejects(getRequisition('1', { query: async () => ({ rows: [] }) }), { status: 404 });
});
