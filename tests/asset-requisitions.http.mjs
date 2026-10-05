// Read-only/invalid-payload checks against loopback only. Cookies stay in memory.
import assert from 'node:assert/strict';
import pg from 'pg';
import { encode } from 'next-auth/jwt';

process.loadEnvFile('.env.local');
const base = new URL(process.env.ASSET_TEST_URL || 'http://127.0.0.1:3105');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname) && base.protocol === 'http:');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let checks = 0;
try {
  await client.connect();
  const accounts = (await client.query('SELECT id::text,role FROM public.app_accounts WHERE is_active AND NOT must_change_password ORDER BY id')).rows;
  const admin = accounts.find((a) => a.role === 'Admin');
  assert.ok(admin);
  const before = (await client.query('SELECT count(*)::text AS total FROM public.asset_requisitions')).rows[0].total;
  async function cookie(account) {
    return 'authjs.session-token=' + await encode({ secret: process.env.AUTH_SECRET, salt: 'authjs.session-token', maxAge: 120,
      token: { sub: account.id, role: account.role, mustChangePassword: false } });
  }
  const adminCookie = await cookie(admin);
  async function request(path, expected, { session = adminCookie, ...options } = {}) {
    const response = await fetch(new URL(path, base), { ...options, redirect: 'manual',
      headers: { ...(session ? { cookie: session } : {}), ...options.headers } });
    assert.equal(response.status, expected, path);
    checks++;
    return response;
  }
  const post = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
  await request('/api/asset-requisitions', 401, { ...post, session: null });
  await request('/api/asset-requisitions/1/pdf', 401, { session: null });
  await request('/api/asset-requisitions/invalid/pdf', 400);
  await request('/api/asset-requisitions/9223372036854775807/pdf', 404);
  await request('/api/asset-requisitions', 400, post);
  await request('/api/asset-requisitions', 400, { ...post, body: '{' });
  await request('/api/asset-requisitions', 403, { ...post, session: await cookie({ id: '9223372036854775807', role: 'Admin' }) });
  const reader = accounts.find((a) => a.role === 'Read-only');
  if (reader) {
    await request('/api/asset-requisitions', 403, { ...post, session: await cookie({ ...reader, role: 'Admin' }) });
    const html = await (await request('/reports/requisitions', 200, { session: await cookie(reader) })).text();
    assert.ok(!html.includes('create-request-heading'));
    checks++;
  }
  const user = (await client.query('SELECT id::text,employee_code FROM public."user" WHERE is_active ORDER BY id LIMIT 1')).rows[0];
  const html = await (await request(`/reports/requisitions?userId=${user.id}`, 200)).text();
  assert.ok(html.includes('create-request-heading') && html.includes('ประวัติใบขอเบิก'));
  assert.ok(html.includes(`"${user.employee_code}`) || html.includes(user.employee_code || 'พนักงานผู้ขอ'));
  checks++;
  const filtered = await (await request('/reports/requisitions?kind=replacement&q=unmatched-test&page=1', 200)).text();
  assert.ok(filtered.includes('ไม่พบใบขอเบิกตามเงื่อนไข')); checks++;
  assert.equal((await client.query('SELECT count(*)::text AS total FROM public.asset_requisitions')).rows[0].total, before);
  const saved = (await client.query('SELECT id::text FROM public.asset_requisitions ORDER BY id LIMIT 1')).rows[0];
  if (saved) {
    const pdf = await request(`/api/asset-requisitions/${saved.id}/pdf`, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.headers.get('cache-control'), 'no-store');
    assert.match(pdf.headers.get('content-disposition'), /^inline;/);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(), '%PDF-');
    const download = await request(`/api/asset-requisitions/${saved.id}/pdf?download=1`, 200);
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    const preview = await (await request(`/reports/requisitions/${saved.id}`, 200)).text();
    assert.ok(preview.includes(`/api/asset-requisitions/${saved.id}/pdf`));
    checks++;
  }
  console.log(`Passed ${checks} local HTTP/auth/render checks; no business data changed.`);
} finally { await client.end(); }
