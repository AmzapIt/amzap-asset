// Read-only HTTP smoke checks against a local build. Short-lived test cookies stay
// in memory and are never printed or sent to a non-loopback host.
import assert from 'node:assert/strict';
import pg from 'pg';
import { encode } from 'next-auth/jwt';

process.loadEnvFile('.env.local');
const base=new URL(process.env.ASSET_TEST_URL || 'http://127.0.0.1:3100');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname) && base.protocol==='http:','Local HTTP server required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
let checks=0;
try {
  await client.connect();
  const accounts=(await client.query('SELECT id::text,role FROM public.app_accounts WHERE is_active AND NOT must_change_password ORDER BY id')).rows;
  const admin=accounts.find((a) => a.role==='Admin');assert.ok(admin);
  const asset=(await client.query('SELECT id::text,asset_code FROM public.assets ORDER BY id LIMIT 1')).rows[0];assert.ok(asset);
  async function cookie(account) {
    return 'authjs.session-token='+await encode({secret:process.env.AUTH_SECRET,salt:'authjs.session-token',maxAge:120,
      token:{sub:account.id,role:account.role,mustChangePassword:false}});
  }
  const adminCookie=await cookie(admin);
  async function request(path,expected,{cookie:sessionCookie=adminCookie,...options}={}) {
    const response=await fetch(new URL(path,base),{...options,redirect:'manual',headers:{...(sessionCookie ? {cookie:sessionCookie} : {}),...options.headers}});
    assert.equal(response.status,expected,`${path}: unexpected status`);checks++;
    return response;
  }
  await request('/api/assets/lookup?code='+encodeURIComponent(asset.asset_code),401,{cookie:null});
  const lookup=await (await request('/api/assets/lookup?code='+encodeURIComponent(asset.asset_code),200)).json();
  assert.equal(lookup.asset.id,asset.id);checks++;
  await request('/api/assets/lookup?code=https%3A%2F%2Fevil.example',400);
  await request(`/api/assets/${asset.id}/history`,200);
  await request('/api/asset-counts',200);
  await request('/api/asset-counts/9223372036854775808',400);
  for (const [path,label] of [['/scan','สแกน QR / เพิ่มรูป Asset'],['/asset-counts','เปิดรอบตรวจนับใหม่'],[`/assets/${asset.id}`,'ประวัติ Asset รวม']]) {
    const html=await (await request(path,200)).text();
    assert.ok(html.includes(label),`${path}: missing rendered content`);checks++;
  }
  // Invalid payload tests stop before any mutation.
  await request('/api/asset-counts',400,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const unknown={id:'9223372036854775807',role:'Admin'};
  await request('/api/asset-counts',403,{cookie:await cookie(unknown)});
  const reader=accounts.find((a) => a.role==='Read-only');
  if (reader) {
    // Even an incorrect Admin claim must not override the current DB role.
    await request('/api/asset-counts',403,{cookie:await cookie({...reader,role:'Admin'}),method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  }
  console.log(`Passed ${checks} local HTTP/auth/render checks. No business data was changed.`);
} finally {await client.end();}
