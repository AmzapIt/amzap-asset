import { getDbPool } from '../lib/db.js';
import { getVerificationRound, listVerificationRounds } from '../lib/asset-verifications.js';

const pool = getDbPool();
try {
  const result = await pool.query(`SELECT
    to_regclass('public.asset_verification_rounds')::text AS rounds_table,
    to_regclass('public.asset_verification_records')::text AS records_table,
    (SELECT COUNT(*)::int FROM public."user" WHERE is_active) AS active_users,
    (SELECT COUNT(*)::int FROM public.app_accounts WHERE is_active) AS active_accounts`);
  console.log(result.rows[0]);
  if (result.rows[0].rounds_table && result.rows[0].records_table) {
    const columns = (await pool.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN
        ('asset_verification_rounds','asset_verification_records')`)).rows;
    const has = (table, column) => columns.some((item) =>
      item.table_name === table && item.column_name === column);
    for (const [table, column] of [
      ['asset_verification_rounds', 'next_sequence'],
      ['asset_verification_records', 'document_no'],
      ['asset_verification_records', 'snapshot'],
      ['asset_verification_records', 'check_result'],
    ]) {
      if (!has(table, column)) throw new Error(`Missing ${table}.${column}`);
    }
    const rounds = await listVerificationRounds();
    console.log('Verification rounds:', rounds.length);
    console.log('Round counts:', (await pool.query(`SELECT r.id::text,r.year,r.round_no,
      COUNT(v.id)::int AS records,
      COUNT(v.id) FILTER (WHERE v.status='signed')::int AS signed,
      COUNT(v.id) FILTER (WHERE v.status='cancelled')::int AS cancelled
      FROM public.asset_verification_rounds r
      LEFT JOIN public.asset_verification_records v ON v.round_id=r.id
      GROUP BY r.id ORDER BY r.id`)).rows);
    if (rounds[0]) {
      const detail = await getVerificationRound(rounds[0].id);
      console.log('Latest round load:', {
        users: detail.users.length, records: detail.records.length,
      });
    }
  }
} finally {
  await pool.end();
}
