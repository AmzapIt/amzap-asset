import assert from 'node:assert/strict';
import test from 'node:test';
import { getItSignerName, saveItSignerName, validateItSignerName } from '../lib/document-settings.js';

test('validates and normalises the IT signer name', () => {
  assert.equal(validateItSignerName('  วัชรกร   ไอที '), 'วัชรกร ไอที');
  assert.equal(validateItSignerName(''), '');
  assert.throws(() => validateItSignerName('ก'.repeat(101)));
  assert.throws(() => validateItSignerName(null));
});

test('missing settings table falls back to blank and save explains the migration', async () => {
  const missing = { query: async () => { const e = new Error('missing'); e.code = '42P01'; throw e; } };
  assert.equal(await getItSignerName(missing), '');
  await assert.rejects(saveItSignerName('IT', '1', missing), /031-app-settings/);
});

test('reads and upserts the stored value', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push(params); return { rows: [{ value: 'IT Name' }] }; } };
  assert.equal(await getItSignerName(db), 'IT Name');
  assert.equal(await saveItSignerName(' New ', '7', db), 'New');
  assert.deepEqual(calls[1], ['document.it_signer_name', 'New', '7']);
});
