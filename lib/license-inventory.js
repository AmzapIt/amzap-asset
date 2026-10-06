import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getDbPool } from './db.js';
import {
  InventoryError, inventoryDate, inventoryId, inventoryMoney, inventoryNumber,
  inventoryOperation, inventoryText, inventoryVersion, todayBangkok,
} from './inventory-core.js';

function encryptionKey() {
  const encoded = process.env.LICENSE_ENCRYPTION_KEY;
  const key = encoded ? Buffer.from(encoded, 'base64url') : null;
  if (!key || key.length !== 32) {
    throw new InventoryError('ยังไม่ได้ตั้งค่า LICENSE_ENCRYPTION_KEY สำหรับเก็บ Product Key', 503);
  }
  return key;
}

export function licenseKeyConfigured() {
  try { encryptionKey(); return true; } catch { return false; }
}

export function encryptProductKey(value) {
  const plain = inventoryText(value, 'Product Key', 2000, true);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    encrypted: `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`,
    hint: plain.slice(-4),
  };
}

export function decryptProductKey(encrypted) {
  if (!encrypted) return null;
  const [version, iv, tag, data] = encrypted.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new InventoryError('รูปแบบ Product Key ไม่ถูกต้อง', 500);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

function optionalId(value, label) {
  return value == null || value === '' ? null : inventoryId(value, label);
}

export function parseLicense(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InventoryError('ข้อมูล License ไม่ถูกต้อง');
  const purchaseDate = inventoryDate(body.purchase_date, 'วันที่ซื้อ');
  const expirationDate = inventoryDate(body.expiration_date, 'วันหมดอายุ');
  if (purchaseDate && expirationDate && expirationDate < purchaseDate) {
    throw new InventoryError('วันหมดอายุต้องไม่ก่อนวันที่ซื้อ');
  }
  if (body.product_key != null && typeof body.product_key !== 'string') throw new InventoryError('Product Key ไม่ถูกต้อง');
  if (body.clear_product_key != null && typeof body.clear_product_key !== 'boolean') throw new InventoryError('คำสั่งลบ Product Key ไม่ถูกต้อง');
  if (body.product_key?.trim() && body.clear_product_key) throw new InventoryError('เลือกใส่หรือลบ Product Key อย่างใดอย่างหนึ่ง');
  return {
    name: inventoryText(body.name, 'ชื่อ License', 200, true),
    vendorId: optionalId(body.vendor_id, 'ผู้ขาย'),
    totalSeats: inventoryNumber(body.total_seats, 'จำนวนสิทธิ์', 1),
    purchaseDate, expirationDate,
    purchaseCost: inventoryMoney(body.purchase_cost),
    notes: inventoryText(body.notes, 'หมายเหตุ', 10000),
    isActive: body.is_active === undefined ? true : requireBoolean(body.is_active, 'สถานะ'),
    productKey: body.product_key?.trim() || null,
    clearKey: body.clear_product_key === true,
  };
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new InventoryError(`${label}ไม่ถูกต้อง`);
  return value;
}

async function ensureVendor(client, vendorId) {
  if (!vendorId) return;
  const vendor = await client.query('SELECT id FROM public.vendors WHERE id=$1', [vendorId]);
  if (!vendor.rowCount) throw new InventoryError('ไม่พบผู้ขาย');
}

async function licenseRow(client, id) {
  const row = (await client.query('SELECT * FROM public.software_licenses WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row) throw new InventoryError('ไม่พบ License', 404);
  return row;
}

async function event(client, licenseId, assignmentId, action, details, actorId, requestId) {
  await client.query(`INSERT INTO public.license_events
    (license_id,assignment_id,action,details,actor_account_id,request_id)
    VALUES($1,$2,$3,$4::jsonb,$5,$6)`,
  [licenseId, assignmentId, action, JSON.stringify(details), actorId, requestId]);
}

export async function createLicense(body, actorId, pool = getDbPool()) {
  return inventoryOperation('license.create', body, actorId, async (client, requestId) => {
    const input = parseLicense(body);
    await ensureVendor(client, input.vendorId);
    const key = input.productKey ? encryptProductKey(input.productKey) : null;
    const row = (await client.query(`INSERT INTO public.software_licenses
      (name,vendor_id,total_seats,product_key_encrypted,product_key_hint,purchase_date,expiration_date,purchase_cost,notes,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text`,
    [input.name, input.vendorId, input.totalSeats, key?.encrypted || null, key?.hint || null,
      input.purchaseDate, input.expirationDate, input.purchaseCost, input.notes, input.isActive])).rows[0];
    await event(client, row.id, null, 'create', { name: input.name, total_seats: input.totalSeats, has_key: Boolean(key) }, actorId, requestId);
    return { id: row.id };
  }, pool);
}

export async function updateLicense(id, body, actorId, pool = getDbPool()) {
  id = inventoryId(id, 'License');
  return inventoryOperation('license.update', body, actorId, async (client, requestId) => {
    const input = parseLicense(body);
    const version = inventoryVersion(body.expected_version);
    const before = await licenseRow(client, id);
    if (before.version !== version) throw new InventoryError('License เปลี่ยนไปแล้ว กรุณาโหลดใหม่', 409);
    const active = (await client.query('SELECT count(*)::int AS count FROM public.license_seat_assignments WHERE license_id=$1 AND released_at IS NULL', [id])).rows[0].count;
    if (input.totalSeats < active) throw new InventoryError(`ลดจำนวนสิทธิ์ต่ำกว่า ${active} สิทธิ์ที่กำลังใช้อยู่ไม่ได้`, 409);
    await ensureVendor(client, input.vendorId);
    const key = input.productKey ? encryptProductKey(input.productKey) : null;
    const encrypted = key ? key.encrypted : input.clearKey ? null : before.product_key_encrypted;
    const hint = key ? key.hint : input.clearKey ? null : before.product_key_hint;
    await client.query(`UPDATE public.software_licenses SET
      name=$2,vendor_id=$3,total_seats=$4,product_key_encrypted=$5,product_key_hint=$6,
      purchase_date=$7,expiration_date=$8,purchase_cost=$9,notes=$10,is_active=$11,
      version=version+1,updated_at=now() WHERE id=$1`,
    [id, input.name, input.vendorId, input.totalSeats, encrypted, hint, input.purchaseDate,
      input.expirationDate, input.purchaseCost, input.notes, input.isActive]);
    await event(client, id, null, 'update', {
      before: { name: before.name, total_seats: before.total_seats, is_active: before.is_active },
      after: { name: input.name, total_seats: input.totalSeats, is_active: input.isActive },
      key_changed: Boolean(key || input.clearKey),
    }, actorId, requestId);
    return { id };
  }, pool);
}

export function parseLicenseAssignment(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InventoryError('ข้อมูลการจ่ายสิทธิ์ไม่ถูกต้อง');
  if (!['user', 'asset'].includes(body.target_type)) throw new InventoryError('เลือกพนักงานหรือ Asset ผู้รับสิทธิ์');
  return {
    targetType: body.target_type,
    targetId: inventoryId(body.target_id, 'ผู้รับสิทธิ์'),
    assignedDate: inventoryDate(body.assigned_date || todayBangkok(), 'วันที่จ่ายสิทธิ์', { required: true, pastOnly: true }),
    notes: inventoryText(body.notes, 'หมายเหตุ', 10000),
  };
}

export async function assignLicense(id, body, actorId, pool = getDbPool()) {
  id = inventoryId(id, 'License');
  return inventoryOperation('license.assign', body, actorId, async (client, requestId) => {
    const input = parseLicenseAssignment(body);
    const license = await licenseRow(client, id);
    if (!license.is_active) throw new InventoryError('License นี้ปิดใช้งานอยู่', 409);
    const target = (await client.query(input.targetType === 'user'
      ? 'SELECT id,is_active FROM public."user" WHERE id=$1 FOR UPDATE'
      : 'SELECT id,status FROM public.assets WHERE id=$1 FOR UPDATE', [input.targetId])).rows[0];
    if (!target || (input.targetType === 'user' && !target.is_active) ||
        (input.targetType === 'asset' && target.status === 'Disposed')) {
      throw new InventoryError('ผู้รับสิทธิ์ไม่มีอยู่หรือไม่พร้อมใช้งาน', 409);
    }
    const active = (await client.query('SELECT count(*)::int AS count FROM public.license_seat_assignments WHERE license_id=$1 AND released_at IS NULL', [id])).rows[0].count;
    if (active >= license.total_seats) throw new InventoryError('จำนวนสิทธิ์เต็มแล้ว', 409);
    const duplicate = (await client.query(`SELECT id FROM public.license_seat_assignments WHERE license_id=$1
      AND released_at IS NULL AND ${input.targetType === 'user' ? 'user_id' : 'asset_id'}=$2`, [id, input.targetId])).rowCount;
    if (duplicate) throw new InventoryError('ผู้รับรายนี้มีสิทธิ์ License นี้อยู่แล้ว', 409);
    const row = (await client.query(`INSERT INTO public.license_seat_assignments
      (license_id,user_id,asset_id,assigned_date,notes,assigned_by_account_id)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text`,
    [id, input.targetType === 'user' ? input.targetId : null,
      input.targetType === 'asset' ? input.targetId : null, input.assignedDate, input.notes, actorId])).rows[0];
    await event(client, id, row.id, 'assign', { target_type: input.targetType, target_id: input.targetId }, actorId, requestId);
    return { id: row.id, license_id: id };
  }, pool);
}

export async function releaseLicense(id, assignmentId, body, actorId, pool = getDbPool()) {
  id = inventoryId(id, 'License');
  assignmentId = inventoryId(assignmentId, 'รายการจ่ายสิทธิ์');
  return inventoryOperation('license.release', body, actorId, async (client, requestId) => {
    const releasedDate = inventoryDate(body.released_date || todayBangkok(), 'วันที่คืนสิทธิ์', { required: true, pastOnly: true });
    const reason = inventoryText(body.reason, 'เหตุผลคืนสิทธิ์', 500, true);
    await licenseRow(client, id);
    const assignment = (await client.query('SELECT *,assigned_date::text AS assigned_date_text FROM public.license_seat_assignments WHERE id=$1 AND license_id=$2 FOR UPDATE', [assignmentId, id])).rows[0];
    if (!assignment) throw new InventoryError('ไม่พบรายการจ่ายสิทธิ์', 404);
    if (assignment.released_at) throw new InventoryError('สิทธิ์นี้คืนแล้ว', 409);
    if (releasedDate < assignment.assigned_date_text) throw new InventoryError('วันที่คืนก่อนวันที่จ่ายสิทธิ์');
    await client.query(`UPDATE public.license_seat_assignments SET released_date=$2,release_reason=$3,
      released_by_account_id=$4,released_at=now() WHERE id=$1`, [assignmentId, releasedDate, reason, actorId]);
    await event(client, id, assignmentId, 'release', { reason }, actorId, requestId);
    return { id: assignmentId, license_id: id };
  }, pool);
}

export async function getLicenseInventory(pool = getDbPool()) {
  const [licenses, assignments, history, users, assets, vendors] = await Promise.all([
    pool.query(`SELECT l.id::text,l.name,l.vendor_id::text,v.name AS vendor_name,l.total_seats,
      l.product_key_hint,l.purchase_date::text,l.expiration_date::text,l.purchase_cost::text,
      l.notes,l.is_active,l.version,l.created_at,
      count(a.id)::int AS used_seats
      FROM public.software_licenses l LEFT JOIN public.vendors v ON v.id=l.vendor_id
      LEFT JOIN public.license_seat_assignments a ON a.license_id=l.id AND a.released_at IS NULL
      GROUP BY l.id,v.name ORDER BY l.name,l.id`),
    pool.query(`SELECT a.id::text,a.license_id::text,a.user_id::text,a.asset_id::text,
      a.assigned_date::text,a.notes,u.full_name,u.nickname,u.employee_code,
      u.is_active AS user_is_active,s.asset_code,s.asset_name
      FROM public.license_seat_assignments a
      LEFT JOIN public."user" u ON u.id=a.user_id LEFT JOIN public.assets s ON s.id=a.asset_id
      WHERE a.released_at IS NULL ORDER BY a.id DESC`),
    pool.query(`SELECT e.id::text,e.license_id::text,e.action,e.details,e.created_at,
      a.display_name AS actor_name,u.full_name,s.asset_code,
      x.assigned_date::text,x.released_date::text,x.release_reason
      FROM public.license_events e LEFT JOIN public.app_accounts a ON a.id=e.actor_account_id
      LEFT JOIN public.license_seat_assignments x ON x.id=e.assignment_id
      LEFT JOIN public."user" u ON u.id=x.user_id LEFT JOIN public.assets s ON s.id=x.asset_id
      ORDER BY e.id DESC LIMIT 100`),
    pool.query('SELECT id::text,full_name,nickname,employee_code FROM public."user" WHERE is_active=true ORDER BY full_name'),
    pool.query("SELECT id::text,asset_code,asset_name FROM public.assets WHERE status<>'Disposed' ORDER BY asset_code"),
    pool.query('SELECT id::text,name,is_active FROM public.vendors ORDER BY name'),
  ]);
  return { licenses: licenses.rows, assignments: assignments.rows, history: history.rows,
    users: users.rows, assets: assets.rows, vendors: vendors.rows, keyConfigured: licenseKeyConfigured() };
}

export async function getLicenseProductKey(id, pool = getDbPool()) {
  id = inventoryId(id, 'License');
  const row = (await pool.query('SELECT product_key_encrypted FROM public.software_licenses WHERE id=$1', [id])).rows[0];
  if (!row) throw new InventoryError('ไม่พบ License', 404);
  return decryptProductKey(row.product_key_encrypted);
}
