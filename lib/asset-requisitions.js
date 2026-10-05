import { isDeepStrictEqual } from 'node:util';
import { getDbPool, query } from './db.js';
import { AssetWorkflowError, assetHolderJoins, workflowId } from './asset-scan.js';

const fail = (message, status = 400) => { throw new AssetWorkflowError(message, status); };
function text(value, max, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    fail(`กรุณากรอกข้อมูลให้ครบ และไม่เกิน ${max} ตัวอักษร`);
  }
  return value.trim();
}

export function parseRequisition(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('ข้อมูลคำขอไม่ถูกต้อง');
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) fail('หมายเลขคำขอไม่ถูกต้อง');
  const userId = workflowId(body.userId);
  const requestedDate = text(body.requestedDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate < '1900-01-01' ||
      !Number.isFinite(Date.parse(`${requestedDate}T00:00:00Z`)) ||
      new Date(`${requestedDate}T00:00:00Z`).toISOString().slice(0, 10) !== requestedDate) fail('วันที่ขอไม่ถูกต้อง');
  if (!['additional', 'replacement'].includes(body.kind)) fail('กรุณาเลือกขอเพิ่มหรือเปลี่ยนทดแทน');
  const reason = text(body.reason, 2000);
  const itStaffName = text(body.itStaffName, 200);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) fail('ระบุอุปกรณ์ 1–20 รายการ');
  const items = body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('รายการอุปกรณ์ไม่ถูกต้อง');
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) fail('จำนวนต้องเป็นเลขจำนวนเต็ม 1–999');
    if (body.kind === 'replacement' && item.quantity !== 1) fail('รายการเปลี่ยนทดแทน / คืนต้องระบุ Asset ต่อรายการ จำนวน 1 เครื่อง');
    const returnedAssetId = body.kind === 'replacement' ? workflowId(item.returnedAssetId) : null;
    const replacementAssetId = body.kind === 'replacement' ? workflowId(item.replacementAssetId) : null;
    return { name: text(item.name, 200), quantity: item.quantity,
      returnedAssetId, replacementAssetId,
      details: text(item.details, 500, false) };
  });
  if (body.kind === 'replacement') {
    for (const field of ['returnedAssetId', 'replacementAssetId']) {
      if (new Set(items.map((item) => item[field])).size !== items.length) fail('ห้ามเลือก Asset ซ้ำในหลายรายการ');
    }
    if (items.some((item) => item.returnedAssetId === item.replacementAssetId)) fail('Asset ที่คืนและ Asset ทดแทนต้องเป็นคนละรายการ');
  }
  return { requestId: body.requestId.toLowerCase(), userId, requestedDate, kind: body.kind, reason, itStaffName, items };
}

async function snapshotItems(client, input, previousItems = []) {
  if (input.kind !== 'replacement') {
    return input.items.map((item) => ({ ...item, returnedAssetCode: '', replacementAssetCode: '' }));
  }
  const replacementCodes = new Map();
  const returnedCodes = new Map();
  for (const previous of previousItems) {
    if (previous.replacementAssetId && previous.replacementAssetCode) replacementCodes.set(previous.replacementAssetId, previous.replacementAssetCode);
    if (previous.returnedAssetId && previous.returnedAssetCode) returnedCodes.set(previous.returnedAssetId, previous.returnedAssetCode);
  }
  const replacementIds = [...new Set(input.items.map((item) => item.replacementAssetId)
    .filter((assetId) => !replacementCodes.has(assetId)))];
  const returnedIds = [...new Set(input.items.map((item) => item.returnedAssetId)
    .filter((assetId) => !returnedCodes.has(assetId)))];
  const replacements = replacementIds.length ? (await client.query(`SELECT asset.id::text,asset.asset_code FROM public.assets asset
    JOIN public.asset_inventory_settings settings ON settings.singleton=true
      AND settings.it_stock_location_id=asset.location_id
    WHERE asset.id=ANY($1::bigint[]) AND asset.status='In Stock'
    ORDER BY asset.id FOR SHARE OF asset`, [replacementIds])).rows : [];
  const returned = returnedIds.length ? (await client.query(`SELECT a.id::text,a.asset_code FROM public.assets a
    ${assetHolderJoins}
    WHERE a.id=ANY($1::bigint[]) AND holder.id=$2
    ORDER BY a.id FOR SHARE OF a`, [returnedIds, input.userId])).rows : [];
  for (const asset of replacements) replacementCodes.set(asset.id, asset.asset_code);
  for (const asset of returned) returnedCodes.set(asset.id, asset.asset_code);
  if (replacementIds.some((assetId) => !replacementCodes.has(assetId))) {
    fail('เลือกได้เฉพาะ Asset ทดแทนที่อยู่ในคลัง IT และมีสถานะ In Stock กรุณาเลือกใหม่', 409);
  }
  if (returnedIds.some((assetId) => !returnedCodes.has(assetId))) {
    fail('Asset ที่เลือกคืนไม่ได้อยู่ในความครอบครองของพนักงาน กรุณาเลือกใหม่', 409);
  }
  return input.items.map((item) => ({ ...item,
    returnedAssetCode: returnedCodes.get(item.returnedAssetId),
    replacementAssetCode: replacementCodes.get(item.replacementAssetId) }));
}

export async function createRequisition(body, accountId, pool = getDbPool()) {
  const input = parseRequisition(body);
  workflowId(accountId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`asset-requisition:${input.requestId}`]);
    const existing = (await client.query('SELECT id::text,created_by_account_id::text,request_payload FROM public.asset_requisitions WHERE request_id=$1', [input.requestId])).rows[0];
    if (existing) {
      if (existing.created_by_account_id !== accountId || !isDeepStrictEqual(existing.request_payload, input)) fail('หมายเลขคำขอถูกใช้กับข้อมูลอื่นแล้ว', 409);
      await client.query('COMMIT');
      return { id: existing.id };
    }
    const employee = (await client.query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.is_active,
      u.position,d.name AS department_name,l.name AS location_name
      FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id
      LEFT JOIN public.locations l ON l.id=u.location_id WHERE u.id=$1 FOR SHARE OF u`, [input.userId])).rows[0];
    if (!employee?.is_active) fail('ไม่พบพนักงานที่ใช้งานอยู่ กรุณาเลือกพนักงานใหม่');
    const savedItems = await snapshotItems(client, input);
    const account = (await client.query('SELECT display_name FROM public.app_accounts WHERE id=$1', [accountId])).rows[0];
    if (!account) fail('ไม่พบบัญชีผู้บันทึก', 403);
    const result = (await client.query(`INSERT INTO public.asset_requisitions
      (request_id,user_id,requested_date,request_kind,reason,it_staff_name,employee_snapshot,items,request_payload,created_by_account_id,created_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) RETURNING id::text`,
    [input.requestId,input.userId,input.requestedDate,input.kind,input.reason,input.itStaffName,JSON.stringify(employee),
      JSON.stringify(savedItems),JSON.stringify(input),accountId,account.display_name])).rows[0];
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function updateRequisition(id, body, accountId, pool = getDbPool()) {
  workflowId(id);
  const input = parseRequisition(body);
  workflowId(accountId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = (await client.query(`SELECT id::text,request_id::text,user_id::text,request_kind,requested_date::text,reason,
      it_staff_name,employee_snapshot,items,request_payload FROM public.asset_requisitions WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!existing) fail('ไม่พบใบขอเบิก', 404);
    if (existing.request_id !== input.requestId) fail('หมายเลขคำขอไม่ตรงกับเอกสาร', 409);
    const employee = (await client.query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.is_active,
      u.position,d.name AS department_name,l.name AS location_name
      FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id
      LEFT JOIN public.locations l ON l.id=u.location_id WHERE u.id=$1 FOR SHARE OF u`, [input.userId])).rows[0];
    if (!employee?.is_active) fail('ไม่พบพนักงานที่ใช้งานอยู่ กรุณาเลือกพนักงานใหม่');
    const previousItems = existing.items.map((item, index) => ({
      ...item,
      returnedAssetId: existing.user_id === input.userId ? item.returnedAssetId || '' : '',
      returnedAssetCode: existing.user_id === input.userId ? item.returnedAssetCode || '' : '',
      replacementAssetId: item.replacementAssetId ||
        existing.request_payload?.items?.[index]?.originalAssetId || '',
    }));
    const savedItems = await snapshotItems(client, input, previousItems);
    const account = (await client.query('SELECT display_name FROM public.app_accounts WHERE id=$1 AND is_active', [accountId])).rows[0];
    if (!account) fail('ไม่พบบัญชีผู้บันทึก', 403);
    const revisionNo = Number((await client.query(`SELECT COALESCE(MAX(revision_no),0)+1 AS next_revision
      FROM public.asset_requisition_revisions WHERE requisition_id=$1`, [id])).rows[0].next_revision);
    await client.query(`INSERT INTO public.asset_requisition_revisions
      (requisition_id,revision_no,request_payload,request_kind,requested_date,reason,it_staff_name,employee_snapshot,items,modified_by_account_id,modified_by_name)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
    [id,revisionNo,JSON.stringify(existing.request_payload),existing.request_kind,existing.requested_date,existing.reason,
      existing.it_staff_name,JSON.stringify(existing.employee_snapshot),JSON.stringify(existing.items),accountId,account.display_name]);
    await client.query(`UPDATE public.asset_requisitions SET user_id=$2,requested_date=$3,request_kind=$4,reason=$5,it_staff_name=$6,
      employee_snapshot=$7::jsonb,items=$8::jsonb,request_payload=$9::jsonb,updated_at=now() WHERE id=$1`,
    [id,input.userId,input.requestedDate,input.kind,input.reason,input.itStaffName,JSON.stringify(employee),
      JSON.stringify(savedItems),JSON.stringify(input)]);
    await client.query('COMMIT');
    return { id, revisionNo };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function getRequisition(id, db = { query }) {
  workflowId(id);
  const result = (await db.query(`SELECT id::text,request_id::text,user_id::text,requested_date::text,request_kind,reason,
    it_staff_name,employee_snapshot,items,request_payload,created_by_name,updated_at
    FROM public.asset_requisitions WHERE id=$1`, [id])).rows[0];
  if (!result) fail('ไม่พบใบขอเบิก', 404);
  result.revisions = (await db.query(`SELECT revision_no,request_kind,requested_date::text,reason,it_staff_name,
    employee_snapshot,items,modified_by_name,modified_at FROM public.asset_requisition_revisions
    WHERE requisition_id=$1 ORDER BY revision_no DESC`, [id])).rows;
  return result;
}

export async function getRequisitionOptions(db = { query }) {
  const [users, types, stockAssets, heldAssets] = await Promise.all([
    db.query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.is_active,
      d.name AS department_name,l.name AS location_name FROM public."user" u
      LEFT JOIN public.departments d ON d.id=u.department_id LEFT JOIN public.locations l ON l.id=u.location_id
      WHERE u.is_active ORDER BY u.full_name,u.id`),
    db.query('SELECT id::text,name FROM public.asset_types ORDER BY name,id'),
    db.query(`SELECT a.id::text,a.asset_code,a.asset_name,a.serial_number
      FROM public.assets a JOIN public.asset_inventory_settings settings ON settings.singleton=true
        AND settings.it_stock_location_id=a.location_id
      WHERE a.status='In Stock' AND NULLIF(BTRIM(a.asset_code),'') IS NOT NULL ORDER BY a.asset_code,a.id`),
    db.query(`SELECT a.id::text,a.asset_code,a.asset_name,a.serial_number,holder.id::text AS holder_id
      FROM public.assets a ${assetHolderJoins}
      WHERE holder.id IS NOT NULL AND NULLIF(BTRIM(a.asset_code),'') IS NOT NULL ORDER BY a.asset_code,a.id`),
  ]);
  return { users: users.rows, types: types.rows, stockAssets: stockAssets.rows, heldAssets: heldAssets.rows };
}

export async function listRequisitions({ search = '', kind = '', page = 1 } = {}, db = { query }) {
  if (typeof search !== 'string' || search.length > 200 || !['', 'additional', 'replacement'].includes(kind) ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000) fail('ตัวกรองคำขอไม่ถูกต้อง');
  // Escape LIKE metacharacters so employee codes and text are searched literally.
  const pattern = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const rows = (await db.query(`SELECT id::text,requested_date::text,request_kind,employee_snapshot,items,reason
    FROM public.asset_requisitions
    WHERE ($1='' OR request_kind=$1)
      AND (concat_ws(' ', 'REQ-'||lpad(id::text,greatest(6,length(id::text)),'0'), id::text, employee_snapshot->>'full_name',
        employee_snapshot->>'nickname',employee_snapshot->>'employee_code',employee_snapshot->>'department_name',reason,items::text) ILIKE $2)
    ORDER BY id DESC LIMIT 51 OFFSET $3`, [kind,pattern,(page - 1) * 50])).rows;
  return { rows: rows.slice(0, 50), hasNext: rows.length > 50 };
}
