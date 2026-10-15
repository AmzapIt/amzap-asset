import { getDbPool, query } from './db.js';
import { AssetWorkflowError, assetHolderJoins, workflowId } from './asset-scan.js';

const fail = (message, status = 400) => { throw new AssetWorkflowError(message, status); };
function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('หมายเลขคำขอไม่ถูกต้อง');
  return value;
}
function text(value, max, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(`กรุณากรอกข้อความ${required ? 'ให้ครบ ' : ''}ไม่เกิน ${max} ตัวอักษร`);
  return value.trim() || null;
}
function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('ข้อมูลไม่ถูกต้อง');
}
export function parseCountSession(body) {
  bodyObject(body);
  return { requestId: uuid(body.requestId), name: text(body.name, 150, true),
    locationId: workflowId(body.locationId, true), assetTypeId: workflowId(body.assetTypeId, true), notes: text(body.notes, 2000) };
}
export function parseCountCheck(body) {
  bodyObject(body);
  if (!['found','mismatch','missing'].includes(body.result)) fail('กรุณาเลือกผลการตรวจนับ');
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) fail('เวอร์ชันรายการไม่ถูกต้อง');
  return { requestId: uuid(body.requestId), result: body.result, expectedVersion: body.expectedVersion,
    observedLocationId: body.result === 'missing' ? null : workflowId(body.observedLocationId, true),
    observedHolderId: body.result === 'missing' ? null : workflowId(body.observedHolderId, true),
    notes: text(body.notes, 2000, body.result === 'mismatch') };
}
export function effectiveCountResult(item, input) {
  if (input.result === 'missing') return 'missing';
  const different = String(item.expected_location_id ?? '') !== String(input.observedLocationId ?? '') ||
    String(item.expected_holder_id ?? '') !== String(input.observedHolderId ?? '');
  return input.result === 'mismatch' || different ? 'mismatch' : 'found';
}

export async function countLookups() {
  const [locations, types, users] = await Promise.all([
    query('SELECT id::text,name FROM public.locations ORDER BY name,id'),
    query('SELECT id::text,name FROM public.asset_types ORDER BY name,id'),
    query('SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.is_active,l.name AS location_name FROM public."user" u LEFT JOIN public.locations l ON l.id=u.location_id ORDER BY u.full_name,u.id'),
  ]);
  return { locations: locations.rows, types: types.rows, users: users.rows };
}

const summaryColumns = `COUNT(i.id)::int AS total,
 COUNT(i.id) FILTER (WHERE i.result='pending')::int AS pending,
 COUNT(i.id) FILTER (WHERE i.result='found')::int AS found,
 COUNT(i.id) FILTER (WHERE i.result='mismatch')::int AS mismatch,
 COUNT(i.id) FILTER (WHERE i.result='missing')::int AS missing`;

export async function listCountSessions(db = { query }) {
  return (await db.query(`SELECT s.*,s.id::text,account.display_name AS created_by_name,${summaryColumns}
    FROM public.asset_count_sessions s
    LEFT JOIN public.asset_count_items i ON i.session_id=s.id
    LEFT JOIN public.app_accounts account ON account.id=s.created_by_account_id
    GROUP BY s.id,account.display_name ORDER BY s.created_at DESC,s.id DESC LIMIT 200`)).rows;
}

export async function getCountSession(sessionId, db = { query }) {
  workflowId(sessionId);
  const session = (await db.query(`SELECT s.*,s.id::text,creator.display_name AS created_by_name,
    closer.display_name AS closed_by_name,${summaryColumns}
    FROM public.asset_count_sessions s
    LEFT JOIN public.asset_count_items i ON i.session_id=s.id
    LEFT JOIN public.app_accounts creator ON creator.id=s.created_by_account_id
    LEFT JOIN public.app_accounts closer ON closer.id=s.closed_by_account_id
    WHERE s.id=$1 GROUP BY s.id,creator.display_name,closer.display_name`, [sessionId])).rows[0];
  if (!session) fail('ไม่พบรอบตรวจนับ', 404);
  const items = (await db.query(`SELECT i.*,i.id::text,i.asset_id::text,
    account.display_name AS checked_by_name
    FROM public.asset_count_items i
    LEFT JOIN public.app_accounts account ON account.id=i.checked_by_account_id
    WHERE session_id=$1 ORDER BY i.asset_code,i.id`, [sessionId])).rows;
  return { session, items };
}

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') fail('คำขอนี้ถูกใช้แล้ว กรุณาโหลดข้อมูลล่าสุด', 409);
    throw error;
  } finally { client.release(); }
}

export async function createCountSession(body, accountId, pool = getDbPool()) {
  const input = parseCountSession(body);
  workflowId(accountId);
  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`asset-count:${input.requestId}`]);
    const existing = (await client.query('SELECT * FROM public.asset_count_sessions WHERE request_id=$1', [input.requestId])).rows[0];
    if (existing) {
      if (String(existing.created_by_account_id) !== accountId || existing.name !== input.name ||
        String(existing.location_id ?? '') !== String(input.locationId ?? '') ||
        String(existing.asset_type_id ?? '') !== String(input.assetTypeId ?? '') || existing.notes !== input.notes) fail('หมายเลขคำขอถูกใช้กับข้อมูลอื่นแล้ว', 409);
      return { id: String(existing.id) };
    }
    let location = null, type = null;
    if (input.locationId) {
      location = (await client.query('SELECT name FROM public.locations WHERE id=$1 FOR SHARE', [input.locationId])).rows[0];
      if (!location) fail('ไม่พบสถานที่');
    }
    if (input.assetTypeId) {
      type = (await client.query('SELECT name FROM public.asset_types WHERE id=$1 FOR SHARE', [input.assetTypeId])).rows[0];
      if (!type) fail('ไม่พบประเภท Asset');
    }
    const session = (await client.query(`INSERT INTO public.asset_count_sessions
      (request_id,name,location_id,asset_type_id,location_name,asset_type_name,notes,created_by_account_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
    [input.requestId,input.name,input.locationId,input.assetTypeId,location?.name ?? null,type?.name ?? null,input.notes,accountId])).rows[0];
    const snapshot = await client.query(`INSERT INTO public.asset_count_items
      (session_id,asset_id,asset_code,asset_name,expected_location_id,expected_location_name,
       expected_holder_id,expected_holder_name,holder_source,expected_status)
      SELECT $1,a.id,a.asset_code,a.asset_name,a.location_id,location.name,holder.id,
        NULLIF(concat_ws(' ',holder_user.full_name,
          CASE WHEN NULLIF(btrim(holder_user.nickname),'') IS NOT NULL THEN '('||btrim(holder_user.nickname)||')' END),''),
        CASE WHEN assignment.assigned_to IS NOT NULL THEN 'assignment'
             WHEN holder.id IS NOT NULL THEN 'legacy_owner' END,a.status
      FROM public.assets a ${assetHolderJoins}
      WHERE ($2::bigint IS NULL OR a.location_id=$2)
        AND ($3::bigint IS NULL OR a.asset_type_id=$3) AND a.status <> 'Disposed'`,
    [session.id,input.locationId,input.assetTypeId]);
    if (!snapshot.rowCount) fail('ไม่มี Asset ในขอบเขตที่เลือก (ไม่รวม Disposed)');
    return session;
  });
}

export async function recordCountCheck(sessionId, itemId, body, accountId, pool = getDbPool()) {
  workflowId(sessionId); workflowId(itemId); workflowId(accountId);
  const input = parseCountCheck(body);
  const payload = JSON.stringify(input);
  return transaction(pool, async (client) => {
    const session = (await client.query('SELECT status FROM public.asset_count_sessions WHERE id=$1 FOR UPDATE', [sessionId])).rows[0];
    if (!session) fail('ไม่พบรอบตรวจนับ', 404);
    const previous = (await client.query('SELECT * FROM public.asset_count_events WHERE request_id=$1', [input.requestId])).rows[0];
    if (previous) {
      // jsonb key order is not insertion order; compare normalized fields.
      const samePayload = previous.request_payload && Object.keys(input).every((key) => previous.request_payload[key] === input[key]);
      if (String(previous.item_id) !== itemId || String(previous.checked_by_account_id) !== accountId || !samePayload) fail('หมายเลขคำขอถูกใช้กับข้อมูลอื่นแล้ว',409);
      const item = (await client.query(`SELECT i.*,i.id::text,i.asset_id::text,account.display_name AS checked_by_name
        FROM public.asset_count_items i LEFT JOIN public.app_accounts account ON account.id=i.checked_by_account_id
        WHERE i.id=$1 AND i.session_id=$2`,[itemId,sessionId])).rows[0];
      if (!item) fail('ไม่พบรายการในรอบนี้',404);
      return item;
    }
    if (session.status !== 'open') fail('รอบนี้ปิดแล้ว ไม่สามารถแก้ผลตรวจนับได้', 409);
    const item = (await client.query('SELECT * FROM public.asset_count_items WHERE id=$1 AND session_id=$2 FOR UPDATE', [itemId,sessionId])).rows[0];
    if (!item) fail('Asset นี้ไม่อยู่ในรอบตรวจนับ',404);
    if (item.version !== input.expectedVersion) fail('รายการถูกแก้ไขแล้ว กรุณาโหลดล่าสุดก่อนบันทึก',409);
    let locationName = null, holderName = null;
    if (input.observedLocationId) {
      const row = (await client.query('SELECT name FROM public.locations WHERE id=$1', [input.observedLocationId])).rows[0];
      if (!row) fail('ไม่พบสถานที่ที่เลือก');
      locationName = row.name;
    }
    if (input.observedHolderId) {
      const row = (await client.query(`SELECT concat_ws(' ',full_name,
        CASE WHEN NULLIF(btrim(nickname),'') IS NOT NULL THEN '('||btrim(nickname)||')' END) AS name
        FROM public."user" WHERE id=$1`, [input.observedHolderId])).rows[0];
      if (!row) fail('ไม่พบพนักงานที่เลือก');
      holderName = row.name;
    }
    const result = effectiveCountResult(item,input);
    if (result === 'mismatch' && !input.notes) fail('กรุณาระบุรายละเอียดที่ไม่ตรงกับระบบ');
    await client.query(`INSERT INTO public.asset_count_events
      (request_id,item_id,request_payload,previous_result,result,observed_location_name,observed_holder_name,notes,checked_by_account_id)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9)`,
    [input.requestId,itemId,payload,item.result,result,locationName,holderName,input.notes,accountId]);
    return (await client.query(`UPDATE public.asset_count_items SET result=$1,
      observed_location_id=$2,observed_location_name=$3,observed_holder_id=$4,observed_holder_name=$5,
      notes=$6,checked_by_account_id=$7,checked_at=now(),version=version+1
      WHERE id=$8 RETURNING *,id::text,asset_id::text,
        (SELECT display_name FROM public.app_accounts WHERE id=$7) AS checked_by_name`,
    [result,input.observedLocationId,locationName,input.observedHolderId,holderName,input.notes,accountId,itemId])).rows[0];
  });
}

export async function closeCountSession(sessionId, accountId, pool = getDbPool()) {
  workflowId(sessionId); workflowId(accountId);
  return transaction(pool, async (client) => {
    const session = (await client.query('SELECT status FROM public.asset_count_sessions WHERE id=$1 FOR UPDATE',[sessionId])).rows[0];
    if (!session) fail('ไม่พบรอบตรวจนับ',404);
    if (session.status === 'open') await client.query(`UPDATE public.asset_count_sessions
      SET status='closed',closed_at=now(),closed_by_account_id=$2 WHERE id=$1`,[sessionId,accountId]);
    return { id: sessionId };
  });
}
