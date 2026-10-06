import { createHash } from 'node:crypto';
import { getDbPool } from './db.js';

export class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function inventoryId(value, label = 'ID') {
  if (!['string', 'number', 'bigint'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isSafeInteger(value))) {
    throw new InventoryError(`${label} ไม่ถูกต้อง`);
  }
  const id = String(value);
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw new InventoryError(`${label} ไม่ถูกต้อง`);
  }
  return id;
}

export function inventoryNumber(value, label, minimum = 0, maximum = 100000) {
  if (!['string', 'number'].includes(typeof value) ||
      !/^\d{1,6}$/.test(String(value)) ||
      Number(value) < minimum || Number(value) > maximum) {
    throw new InventoryError(`${label}ต้องเป็นจำนวนเต็ม ${minimum}–${maximum}`);
  }
  return Number(value);
}

export function inventoryText(value, label, maximum, required = false) {
  if (value == null || value === '') {
    if (required) throw new InventoryError(`กรุณาระบุ${label}`);
    return null;
  }
  if (typeof value !== 'string') throw new InventoryError(`${label}ไม่ถูกต้อง`);
  const normalized = value.trim();
  if (normalized.length > maximum || (required && !normalized)) {
    throw new InventoryError(`${label}ต้องมีความยาว ${required ? 1 : 0}–${maximum} ตัวอักษร`);
  }
  return normalized || null;
}

export function inventoryDate(value, label, { required = false, pastOnly = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new InventoryError(`กรุณาระบุ${label}`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    throw new InventoryError(`${label}ไม่ถูกต้อง`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ||
      (pastOnly && value > todayBangkok())) {
    throw new InventoryError(`${label}ไม่ถูกต้อง`);
  }
  return value;
}

export function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function inventoryRequestId(value) {
  if (typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new InventoryError('Request ID ไม่ถูกต้อง');
  }
  return value.toLowerCase();
}

export function inventoryVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InventoryError('ข้อมูลหน้าจอไม่ตรงกับข้อมูลล่าสุด กรุณาโหลดใหม่', 409);
  }
  return value;
}

export function inventoryMoney(value) {
  if (value == null || value === '') return null;
  if (!['string', 'number'].includes(typeof value) ||
      !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(String(value))) {
    throw new InventoryError('ราคาซื้อไม่ถูกต้อง');
  }
  return String(value);
}

export async function inventoryOperation(kind, body, actorId, handler, pool = getDbPool()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InventoryError('ข้อมูลคำขอไม่ถูกต้อง');
  }
  const requestId = inventoryRequestId(body.request_id);
  actorId = inventoryId(actorId, 'บัญชี');
  const fingerprint = createHash('sha256').update(JSON.stringify({ kind, body })).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`inventory:${requestId}`]);
    const prior = (await client.query('SELECT kind,actor_account_id::text,fingerprint,response FROM public.inventory_operations WHERE request_id=$1', [requestId])).rows[0];
    if (prior) {
      if (prior.kind !== kind || prior.actor_account_id !== actorId || prior.fingerprint !== fingerprint) {
        throw new InventoryError('Request ID นี้ถูกใช้กับข้อมูลอื่นแล้ว', 409);
      }
      await client.query('COMMIT');
      return prior.response;
    }
    const result = await handler(client, requestId);
    await client.query('INSERT INTO public.inventory_operations(request_id,kind,actor_account_id,fingerprint,response) VALUES($1,$2,$3,$4,$5::jsonb)',
      [requestId, kind, actorId, fingerprint, JSON.stringify(result)]);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
