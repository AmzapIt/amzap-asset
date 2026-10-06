import { getDbPool } from './db.js';
import {
  InventoryError, inventoryDate, inventoryId, inventoryNumber, inventoryOperation,
  inventoryText, inventoryVersion, todayBangkok,
} from './inventory-core.js';

function optionalId(value, label) {
  return value == null || value === '' ? null : inventoryId(value, label);
}

export function parseConsumable(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InventoryError('ข้อมูล Consumable ไม่ถูกต้อง');
  const isActive = body.is_active === undefined ? true : body.is_active;
  if (typeof isActive !== 'boolean') throw new InventoryError('สถานะไม่ถูกต้อง');
  return {
    name: inventoryText(body.name, 'ชื่อ Consumable', 200, true),
    category: inventoryText(body.category, 'ประเภท', 120),
    brand: inventoryText(body.brand, 'ยี่ห้อ', 150),
    model: inventoryText(body.model, 'รุ่น', 150),
    unit: inventoryText(body.unit || 'ชิ้น', 'หน่วยนับ', 40, true),
    vendorId: optionalId(body.vendor_id, 'ผู้ขาย'),
    minQuantity: inventoryNumber(body.min_quantity ?? 0, 'จำนวนขั้นต่ำ'),
    notes: inventoryText(body.notes, 'หมายเหตุ', 10000),
    isActive,
  };
}

async function ensureVendor(client, id) {
  if (id && !(await client.query('SELECT id FROM public.vendors WHERE id=$1', [id])).rowCount) {
    throw new InventoryError('ไม่พบผู้ขาย');
  }
}

async function itemRow(client, id) {
  const row = (await client.query('SELECT * FROM public.consumable_items WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row) throw new InventoryError('ไม่พบ Consumable', 404);
  return row;
}

export async function createConsumable(body, actorId, pool = getDbPool()) {
  return inventoryOperation('consumable.create', body, actorId, async client => {
    const input = parseConsumable(body);
    await ensureVendor(client, input.vendorId);
    const row = (await client.query(`INSERT INTO public.consumable_items
      (name,category,brand,model,unit,vendor_id,min_quantity,notes,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text`,
    [input.name, input.category, input.brand, input.model, input.unit, input.vendorId,
      input.minQuantity, input.notes, input.isActive])).rows[0];
    return { id: row.id };
  }, pool);
}

export async function updateConsumable(id, body, actorId, pool = getDbPool()) {
  id = inventoryId(id, 'Consumable');
  return inventoryOperation('consumable.update', body, actorId, async client => {
    const input = parseConsumable(body);
    const expected = inventoryVersion(body.expected_version);
    const item = await itemRow(client, id);
    if (item.version !== expected) throw new InventoryError('ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดใหม่', 409);
    await ensureVendor(client, input.vendorId);
    await client.query(`UPDATE public.consumable_items SET
      name=$2,category=$3,brand=$4,model=$5,unit=$6,vendor_id=$7,min_quantity=$8,
      notes=$9,is_active=$10,version=version+1,updated_at=now() WHERE id=$1`,
    [id, input.name, input.category, input.brand, input.model, input.unit, input.vendorId,
      input.minQuantity, input.notes, input.isActive]);
    return { id };
  }, pool);
}

export function parseConsumableMovement(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InventoryError('ข้อมูลการเคลื่อนไหวไม่ถูกต้อง');
  if (!['receive', 'issue', 'adjust'].includes(body.action)) throw new InventoryError('วิธีปรับยอดไม่ถูกต้อง');
  return {
    action: body.action,
    quantity: body.action === 'adjust' ? null : inventoryNumber(body.quantity, 'จำนวน', 1),
    newQuantity: body.action === 'adjust' ? inventoryNumber(body.new_quantity, 'ยอดที่ตรวจนับ') : null,
    userId: body.action === 'issue' ? inventoryId(body.user_id, 'พนักงาน') : null,
    date: inventoryDate(body.event_date || todayBangkok(), 'วันที่ดำเนินการ', { required: true, pastOnly: true }),
    reason: inventoryText(body.reason, 'เหตุผล', 500, true),
    notes: inventoryText(body.notes, 'หมายเหตุ', 10000),
  };
}

export async function moveConsumable(id, body, actorId, pool = getDbPool()) {
  id = inventoryId(id, 'Consumable');
  return inventoryOperation('consumable.move', body, actorId, async (client, requestId) => {
    const input = parseConsumableMovement(body);
    const item = await itemRow(client, id);
    if (!item.is_active) throw new InventoryError('Consumable นี้ปิดใช้งานอยู่', 409);
    if (input.userId) {
      const user = (await client.query('SELECT is_active FROM public."user" WHERE id=$1 FOR UPDATE', [input.userId])).rows[0];
      if (!user?.is_active) throw new InventoryError('พนักงานไม่พร้อมรับเบิก', 409);
    }
    const delta = input.action === 'receive' ? input.quantity
      : input.action === 'issue' ? -input.quantity
        : input.newQuantity - item.available_quantity;
    if (delta === 0) throw new InventoryError('ยอดใหม่เท่ากับยอดเดิม ไม่ต้องปรับยอด');
    const balance = item.available_quantity + delta;
    if (balance < 0) throw new InventoryError('ยอดในคลังไม่พอเบิก', 409);
    if (balance > 100000) throw new InventoryError('ยอดในคลังเกิน 100,000 หน่วย');
    await client.query('UPDATE public.consumable_items SET available_quantity=$2,version=version+1,updated_at=now() WHERE id=$1', [id, balance]);
    const row = (await client.query(`INSERT INTO public.consumable_movements
      (item_id,action,quantity,stock_delta,balance_after,user_id,event_date,reason,notes,actor_account_id,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id::text`,
    [id, input.action, Math.abs(delta), delta, balance, input.userId, input.date,
      input.reason, input.notes, actorId, requestId])).rows[0];
    return { id: row.id, item_id: id, available_quantity: balance };
  }, pool);
}

export async function getConsumableInventory(pool = getDbPool()) {
  const [items, movements, users, vendors] = await Promise.all([
    pool.query(`SELECT i.id::text,i.name,i.category,i.brand,i.model,i.unit,
      i.vendor_id::text,v.name AS vendor_name,i.available_quantity,i.min_quantity,
      i.notes,i.is_active,i.version,i.created_at
      FROM public.consumable_items i LEFT JOIN public.vendors v ON v.id=i.vendor_id
      ORDER BY i.name,i.id`),
    pool.query(`SELECT m.id::text,m.item_id::text,m.action,m.quantity,m.stock_delta,
      m.balance_after,m.user_id::text,m.event_date::text,m.reason,m.notes,m.created_at,
      u.full_name,u.nickname,u.employee_code,a.display_name AS actor_name
      FROM public.consumable_movements m LEFT JOIN public."user" u ON u.id=m.user_id
      LEFT JOIN public.app_accounts a ON a.id=m.actor_account_id
      ORDER BY m.id DESC LIMIT 200`),
    pool.query('SELECT id::text,full_name,nickname,employee_code FROM public."user" WHERE is_active=true ORDER BY full_name'),
    pool.query('SELECT id::text,name,is_active FROM public.vendors ORDER BY name'),
  ]);
  return { items: items.rows, movements: movements.rows, users: users.rows, vendors: vendors.rows,
    summary: { available: items.rows.reduce((sum, item) => sum + item.available_quantity, 0),
      lowStock: items.rows.filter(item => item.is_active && item.available_quantity <= item.min_quantity).length } };
}
