// All fixtures and schema changes are rolled back. Existing assets are only read.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createCountSession, getCountSession, recordCountCheck, closeCountSession } from '../lib/asset-counts.js';
import { getAssetHistory, recordAssetEdit } from '../lib/asset-history.js';
import { lookupAsset } from '../lib/asset-scan.js';

process.loadEnvFile('.env.local');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
let checks=0;
const check=(condition) => {assert.ok(condition);checks++;};
const pool={connect:async () => ({
  query:(sql,values) => client.query(sql === 'BEGIN' ? 'SAVEPOINT count_test' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT count_test' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT count_test' : sql,values),
  release() {},
})};
try {
  await client.connect();
  await client.query('BEGIN');
  const migration=await readFile(new URL('../migrations/023-asset-counts-and-history.sql',import.meta.url),'utf8');
  await client.query(migration.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));
  const account=(await client.query("SELECT id::text FROM public.app_accounts WHERE is_active AND role='Admin' ORDER BY id LIMIT 1")).rows[0];
  assert.ok(account,'An active Admin is required');
  const before=(await client.query('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) AS digest FROM public.assets a')).rows[0].digest;
  const request={requestId:randomUUID(),name:'TEST rollback only',notes:'Integration test'};
  const created=await createCountSession(request,account.id,pool);
  const repeat=await createCountSession(request,account.id,pool);
  check(repeat.id===created.id);
  await assert.rejects(createCountSession({...request,name:'Different'},account.id,pool),{status:409});checks++;
  const initial=await getCountSession(created.id,client);
  check(initial.items.length>1 && initial.session.pending===initial.items.length);
  const item=initial.items[0];
  const asset=await lookupAsset(item.asset_code,client);
  check(asset.id===item.asset_id);
  const input={requestId:randomUUID(),result:'found',expectedVersion:0,
    observedLocationId:item.expected_location_id == null ? null : String(item.expected_location_id),
    observedHolderId:item.expected_holder_id == null ? null : String(item.expected_holder_id)};
  const saved=await recordCountCheck(created.id,item.id,input,account.id,pool);
  check(saved.result==='found' && saved.version===1);
  check((await recordCountCheck(created.id,item.id,input,account.id,pool)).version===1);
  await assert.rejects(recordCountCheck(created.id,item.id,{...input,requestId:randomUUID()},account.id,pool),{status:409});checks++;
  await assert.rejects(recordCountCheck(created.id,item.id,{...input,notes:'Changed retry'},account.id,pool),{status:409});checks++;
  const mismatch=await recordCountCheck(created.id,item.id,{...input,requestId:randomUUID(),expectedVersion:1,result:'mismatch',notes:'Serial sticker differs'},account.id,pool);
  check(mismatch.result==='mismatch' && mismatch.version===2);
  const missing=await recordCountCheck(created.id,initial.items[1].id,{requestId:randomUUID(),expectedVersion:0,result:'missing',notes:'Checked location'},account.id,pool);
  check(missing.result==='missing');
  const summary=await getCountSession(created.id,client);
  check(summary.session.found===0 && summary.session.mismatch===1 && summary.session.missing===1 && summary.session.pending===initial.items.length-2);
  await recordAssetEdit(client,item.asset_id,account.id,{status:'In Stock'},{status:'Disposed',notes:'test only'},'integration disposal reason');
  const history=await getAssetHistory(item.asset_id,null,client);
  check(history.events.some((e) => e.kind==='count' && e.details['รอบตรวจนับ']==='TEST rollback only'));
  check(history.events.some((e) => e.kind==='disposal' && e.title==='จำหน่าย Asset' &&
    e.details['เหตุผล']==='integration disposal reason' && e.actor && e.changes.some((c) => c.after==='Disposed')));
  // Multiple events with the same microsecond must paginate without gaps or repeats.
  await client.query(`INSERT INTO public.asset_audit_logs(asset_id,record_id,table_name,action,new_values,changed_by_account_id)
    SELECT $1,$1,'assets','EDIT','{"notes":"pagination test"}'::jsonb,$2 FROM generate_series(1,55)`,[item.asset_id,account.id]);
  const firstPage=await getAssetHistory(item.asset_id,null,client);
  check(firstPage.events.length===50 && Boolean(firstPage.nextCursor));
  const secondPage=await getAssetHistory(item.asset_id,firstPage.nextCursor,client);
  check(secondPage.events.length>0 && !secondPage.events.some((e) => firstPage.events.some((f) => f.event_key===e.event_key)));
  await closeCountSession(created.id,account.id,pool);
  await closeCountSession(created.id,account.id,pool);
  const closed=await getCountSession(created.id,client);
  check(closed.session.status==='closed' && closed.session.pending===summary.session.pending);
  await assert.rejects(recordCountCheck(created.id,item.id,{...input,requestId:randomUUID(),expectedVersion:2},account.id,pool),{status:409});checks++;
  // A response lost just before closing can still be retried safely after closing.
  check((await recordCountCheck(created.id,item.id,input,account.id,pool)).version===2);
  const after=(await client.query('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) AS digest FROM public.assets a')).rows[0].digest;
  check(before===after);
  console.log(`Passed ${checks} PostgreSQL count/history checks; all fixtures rolled back.`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
