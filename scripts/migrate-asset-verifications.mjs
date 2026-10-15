import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const source = await readFile(new URL('../migrations/029-asset-verifications.sql', import.meta.url), 'utf8');
if (!/^BEGIN;\s*/.test(source) || !/\s*COMMIT;\s*$/.test(source)) {
  throw new Error('Unexpected migration structure');
}
const sql = source.replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  const result = await client.query(`SELECT
    to_regclass('public.asset_verification_rounds')::text AS rounds_table,
    to_regclass('public.asset_verification_records')::text AS records_table`);
  if (!result.rows[0].rounds_table || !result.rows[0].records_table) {
    throw new Error('Verification tables were not created');
  }
  if (apply) {
    await client.query('COMMIT');
    console.log('Migration 029 applied:', result.rows[0]);
  } else {
    await client.query('ROLLBACK');
    console.log('Migration 029 validated and rolled back:', result.rows[0]);
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
