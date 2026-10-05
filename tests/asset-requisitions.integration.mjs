// Test fixtures and migration are rolled back; no real requests are retained.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createRequisition, getRequisition, listRequisitions, updateRequisition } from '../lib/asset-requisitions.js';
import { assetHolderJoins } from '../lib/asset-scan.js';

process.loadEnvFile('.env.local');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const pool = { connect: async () => ({
  query: (sql, values) => client.query(sql === 'BEGIN' ? 'SAVEPOINT requisition_test'
    : sql === 'COMMIT' ? 'RELEASE SAVEPOINT requisition_test'
    : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT requisition_test' : sql, values),
  release() {},
}) };
const tracked = ['assets', 'asset_assignments', 'asset_stock_receipts', 'accessory_stock_items', 'employee_accessories'];
async function stockSnapshot() {
  const values = [];
  for (const table of tracked) values.push((await client.query(`SELECT md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) AS digest FROM public.${table} t`)).rows[0].digest);
  return values;
}
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  for (const migrationName of ['025-asset-requisitions.sql', '026-asset-requisition-edits.sql']) {
    const migration = await readFile(new URL(`../migrations/${migrationName}`, import.meta.url), 'utf8');
    await client.query(migration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
  }
  const account = (await client.query("SELECT id::text FROM public.app_accounts WHERE is_active AND role='Admin' ORDER BY id LIMIT 1")).rows[0];
  assert.ok(account, 'An active Admin is required');
  const asset = (await client.query(`SELECT a.id::text,a.asset_code FROM public.assets a
    JOIN public.asset_inventory_settings settings ON settings.singleton=true
      AND settings.it_stock_location_id=a.location_id
    WHERE a.status='In Stock' ORDER BY a.id LIMIT 1`)).rows[0];
  assert.ok(asset, 'At least one In Stock Asset at the IT stock location is required');
  const heldAsset = (await client.query(`SELECT a.id::text,a.asset_code,holder.id::text AS user_id
    FROM public.assets a ${assetHolderJoins}
    WHERE holder.id IS NOT NULL ORDER BY a.id LIMIT 1`)).rows[0];
  assert.ok(heldAsset, 'At least one currently held Asset is required');
  const user = (await client.query(`INSERT INTO public."user" (full_name,nickname,employee_code,is_active)
    VALUES ('Requisition rollback test','ทดสอบ', $1, true) RETURNING id::text`, [`T${randomUUID().slice(0, 8)}`])).rows[0];
  const before = await stockSnapshot();
  const input = { requestId: randomUUID(), userId: user.id, requestedDate: '2026-10-05',
    kind: 'additional', reason: `Rollback only ${randomUUID()}`, itStaffName: 'IT Rollback Test',
    items: [{ name: 'Monitor', quantity: 2 }] };
  const saved = await createRequisition(input, account.id, pool);
  assert.equal((await createRequisition(input, account.id, pool)).id, saved.id, 'retry must return the same document');
  await assert.rejects(createRequisition({ ...input, reason: 'Changed retry' }, account.id, pool), { status: 409 });
  const document = await getRequisition(saved.id, client);
  assert.equal(document.employee_snapshot.nickname, 'ทดสอบ');
  assert.equal(document.items[0].quantity, 2);
  assert.equal(document.requested_date, input.requestedDate);
  const replacementInput = { ...input, requestId: randomUUID(), userId: heldAsset.user_id, kind: 'replacement',
    items: [{ name: 'Notebook', quantity: 1, returnedAssetId: heldAsset.id, replacementAssetId: asset.id, details: 'ชำรุด' }] };
  const replacement = await createRequisition(replacementInput, account.id, pool);
  assert.equal((await getRequisition(replacement.id, client)).items[0].returnedAssetCode, heldAsset.asset_code);
  assert.equal((await getRequisition(replacement.id, client)).items[0].replacementAssetCode, asset.asset_code);
  const edited = await updateRequisition(replacement.id, { ...replacementInput, reason: 'แก้ไขรายละเอียด',
    itStaffName: 'IT Revised' }, account.id, pool);
  assert.equal(edited.revisionNo, 1);
  const revisedDocument = await getRequisition(replacement.id, client);
  assert.equal(revisedDocument.reason, 'แก้ไขรายละเอียด');
  assert.equal(revisedDocument.it_staff_name, 'IT Revised');
  assert.equal(revisedDocument.revisions.length, 1);
  assert.equal(revisedDocument.revisions[0].reason, replacementInput.reason);
  const history = await listRequisitions({ search: 'แก้ไขรายละเอียด' }, client);
  assert.equal(history.rows.length, 1);
  assert.equal((await listRequisitions({ search: 'แก้ไขรายละเอียด', kind: 'replacement' }, client)).rows.length, 1);
  await client.query('UPDATE public."user" SET nickname=$1,is_active=false WHERE id=$2', ['changed', user.id]);
  assert.equal((await getRequisition(saved.id, client)).employee_snapshot.nickname, 'ทดสอบ', 'print must retain the original employee snapshot');
  await assert.rejects(createRequisition({ ...input, requestId: randomUUID() }, account.id, pool), { status: 400 });
  assert.equal((await createRequisition(input, account.id, pool)).id, saved.id, 'retry still works after employee becomes inactive');
  assert.deepEqual(await stockSnapshot(), before, 'requisitions must not change assets, assignments or stock');
  await client.query('DELETE FROM public."user" WHERE id=$1', [user.id]);
  assert.equal((await getRequisition(saved.id, client)).employee_snapshot.full_name, 'Requisition rollback test');
  console.log('Passed PostgreSQL requisition checks: additional/replacement, retry/conflict, history/filter, employee snapshots, inactive employee, no stock changes; all fixtures rolled back.');
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
