// Opt-in PostgreSQL integration test. Migration and all fixtures run inside
// one outer transaction that always rolls back, including on assertion failure.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getDbPool } from '../lib/db.js';
import { createLicense, updateLicense, assignLicense, releaseLicense,
  getLicenseInventory, getLicenseProductKey } from '../lib/license-inventory.js';
import { createConsumable, updateConsumable, moveConsumable,
  getConsumableInventory } from '../lib/consumable-inventory.js';
import { startOffboarding, getOffboardingOverview, getOffboardingSummaries,
  closeOffboarding } from '../lib/offboarding.js';
import { getItFollowUp } from '../lib/it-follow-up.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env.local');
const previousKey = process.env.LICENSE_ENCRYPTION_KEY;
process.env.LICENSE_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
const pool = getDbPool();
const client = await pool.connect();
let checks = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const reject = async fn => { await assert.rejects(fn); checks++; };
const request = fields => ({ request_id: randomUUID(), ...fields });
let savepoint = 0;
let queue = Promise.resolve();
const serialQuery = (sql, params) => {
  const result = queue.then(() => client.query(sql, params));
  queue = result.catch(() => {});
  return result;
};
const scoped = {
  query: serialQuery,
  connect: async () => {
    const name = `inventory_operation_${++savepoint}`;
    return { query(sql, params) {
      if (sql === 'BEGIN') return serialQuery(`SAVEPOINT ${name}`);
      if (sql === 'COMMIT') return serialQuery(`RELEASE SAVEPOINT ${name}`);
      if (sql === 'ROLLBACK') return serialQuery(`ROLLBACK TO SAVEPOINT ${name}`).then(() => serialQuery(`RELEASE SAVEPOINT ${name}`));
      return serialQuery(sql, params);
    }, release() {} };
  },
};

try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '3s'");
  const migration = (await readFile(new URL('../migrations/027-licenses-consumables.sql', import.meta.url), 'utf8'))
    .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
  await client.query(migration);
  await client.query(migration);
  const actor = (await client.query("SELECT id::text FROM public.app_accounts WHERE is_active=true AND role='Admin' ORDER BY id LIMIT 1")).rows[0]?.id;
  assert.ok(actor, 'An active Admin is required for the operation history');
  const suffix = randomUUID();
  const addUser = async name => (await client.query('INSERT INTO public."user"(full_name) VALUES($1) RETURNING id::text', [`QA ${name} ${suffix}`])).rows[0].id;
  const firstUser = await addUser('first');
  const secondUser = await addUser('second');
  const thirdUser = await addUser('third');

  const licenseBody = request({ name: `QA License ${suffix}`, total_seats: 2,
    expiration_date: '2027-12-31', product_key: 'QA-PRIVATE-1234', is_active: true });
  const license = await createLicense(licenseBody, actor, scoped);
  equal((await createLicense(licenseBody, actor, scoped)).id, license.id);
  await reject(() => createLicense({ ...licenseBody, name: 'Changed' }, actor, scoped));
  equal(await getLicenseProductKey(license.id, scoped), 'QA-PRIVATE-1234');
  const assignBody = request({ target_type: 'user', target_id: firstUser, assigned_date: '2024-01-01' });
  const first = await assignLicense(license.id, assignBody, actor, scoped);
  equal((await assignLicense(license.id, assignBody, actor, scoped)).id, first.id);
  await reject(() => assignLicense(license.id, request({ target_type: 'user', target_id: firstUser }), actor, scoped));
  const second = await assignLicense(license.id, request({ target_type: 'user', target_id: secondUser }), actor, scoped);
  await reject(() => assignLicense(license.id, request({ target_type: 'user', target_id: thirdUser }), actor, scoped));
  let state = await getLicenseInventory(scoped);
  let row = state.licenses.find(item => item.id === license.id);
  equal(row.used_seats, 2);
  assert.ok(!JSON.stringify(state).includes('QA-PRIVATE-1234'), 'list response must not reveal the Product Key');
  await reject(() => updateLicense(license.id, request({ name: row.name, total_seats: 1,
    is_active: true, expected_version: row.version }), actor, scoped));
  const releaseBody = request({ released_date: '2024-01-02', reason: 'ย้ายสิทธิ์' });
  await releaseLicense(license.id, first.id, releaseBody, actor, scoped);
  await releaseLicense(license.id, first.id, releaseBody, actor, scoped);
  equal((await getLicenseInventory(scoped)).licenses.find(item => item.id === license.id).used_seats, 1);
  await reject(() => releaseLicense(license.id, first.id, request({ reason: 'ซ้ำ' }), actor, scoped));
  await releaseLicense(license.id, second.id, request({ reason: 'ยกเลิก' }), actor, scoped);
  state = await getLicenseInventory(scoped);
  row = state.licenses.find(item => item.id === license.id);
  await updateLicense(license.id, request({ name: row.name, total_seats: 1,
    is_active: true, expected_version: row.version }), actor, scoped);
  equal((await getLicenseInventory(scoped)).licenses.find(item => item.id === license.id).total_seats, 1);
  const asset = (await client.query("SELECT id::text FROM public.assets WHERE status<>'Disposed' ORDER BY id LIMIT 1")).rows[0];
  if (asset) {
    const assetSeat = await assignLicense(license.id,
      request({ target_type: 'asset', target_id: asset.id, assigned_date: '2024-01-01' }), actor, scoped);
    equal((await getLicenseInventory(scoped)).assignments.find(a => a.id === assetSeat.id).asset_id, asset.id);
    await releaseLicense(license.id, assetSeat.id, request({ reason: 'ทดสอบคืนสิทธิ์' }), actor, scoped);
  }
  const leavingSeat = await assignLicense(license.id,
    request({ target_type: 'user', target_id: thirdUser, assigned_date: '2024-01-01' }), actor, scoped);
  await startOffboarding(thirdUser, actor, scoped);
  equal((await getOffboardingOverview(thirdUser, scoped)).pendingItems, 1);
  equal((await getOffboardingSummaries(scoped)).get(thirdUser).pending_items, 1);
  assert.ok((await getItFollowUp(scoped)).offboarding.some(row => row.user_id === thirdUser));
  checks++;
  await reject(() => closeOffboarding(thirdUser, actor, scoped));
  await releaseLicense(license.id, leavingSeat.id, request({ reason: 'พนักงานลาออก' }), actor, scoped);
  await closeOffboarding(thirdUser, actor, scoped);

  const item = await createConsumable(request({ name: `QA Toner ${suffix}`, category: 'หมึก',
    unit: 'กล่อง', min_quantity: 2, is_active: true }), actor, scoped);
  const receiveBody = request({ action: 'receive', quantity: 10, reason: 'ซื้อเข้า', event_date: '2024-01-01' });
  await moveConsumable(item.id, receiveBody, actor, scoped);
  equal((await moveConsumable(item.id, receiveBody, actor, scoped)).available_quantity, 10);
  await moveConsumable(item.id, request({ action: 'issue', quantity: 3, user_id: firstUser,
    reason: 'ใช้ในงาน', event_date: '2024-01-02' }), actor, scoped);
  await reject(() => moveConsumable(item.id, request({ action: 'issue', quantity: 8, user_id: firstUser,
    reason: 'เกินยอด' }), actor, scoped));
  await moveConsumable(item.id, request({ action: 'adjust', new_quantity: 2,
    reason: 'ตรวจนับ', event_date: '2024-01-03' }), actor, scoped);
  const inventory = await getConsumableInventory(scoped);
  const consumable = inventory.items.find(candidate => candidate.id === item.id);
  equal(consumable.available_quantity, 2);
  equal(inventory.movements.filter(movement => movement.item_id === item.id).length, 3);
  assert.ok(inventory.summary.lowStock >= 1);
  checks++;
  await reject(() => updateConsumable(item.id, request({ name: consumable.name, min_quantity: 3,
    expected_version: consumable.version - 1 }), actor, scoped));
  await updateConsumable(item.id, request({ name: consumable.name, min_quantity: 3,
    expected_version: consumable.version }), actor, scoped);
  equal((await getConsumableInventory(scoped)).items.find(candidate => candidate.id === item.id).min_quantity, 3);
  console.log(`License and Consumables integration checks passed: ${checks}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  client.release();
  await pool.end();
  if (previousKey === undefined) delete process.env.LICENSE_ENCRYPTION_KEY;
  else process.env.LICENSE_ENCRYPTION_KEY = previousKey;
}
