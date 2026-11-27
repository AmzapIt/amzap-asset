import { createHash } from "node:crypto";
import { getDbPool } from "./db.js";

export class AccessoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new AccessoryError(message, status); };

export function accessoryId(value, label = "ID") {
  if (!["string","number","bigint"].includes(typeof value) || (typeof value === "number" && !Number.isSafeInteger(value))) fail(`${label} ไม่ถูกต้อง`);
  const id = String(value ?? "");
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) fail(`${label} ไม่ถูกต้อง`);
  return id;
}
export function accessoryQuantity(value) {
  if (!["string","number"].includes(typeof value)) fail("จำนวนต้องเป็นจำนวนเต็ม 1–100,000");
  if (!/^[1-9]\d{0,5}$/.test(String(value)) || Number(value) > 100000) fail("จำนวนต้องเป็นจำนวนเต็ม 1–100,000");
  return Number(value);
}
export function accessoryText(value, label, maximum = 500, required = false) {
  if (value == null || value === "") { if (required) fail(`กรุณาระบุ${label}`); return null; }
  if (typeof value !== "string") fail(`${label}ไม่ถูกต้อง`);
  const text = value.trim();
  if (text.length > maximum || (required && !text)) fail(`${label}ต้องมีความยาว ${required ? 1 : 0}–${maximum} ตัวอักษร`);
  return text || null;
}
export function accessoryDate(value) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (value == null || value === "") return today;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) fail("วันที่ไม่ถูกต้อง");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value || value > today) fail("วันที่ไม่ถูกต้องหรือเป็นวันที่ในอนาคต");
  return value;
}
function version(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("ข้อมูลหน้าจอไม่ครบ กรุณาโหลดใหม่", 409);
  return value;
}
function requestId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail("Request ID ไม่ถูกต้อง กรุณาโหลดใหม่");
  return value;
}
function remaining(row) {
  return row.returned_date ? 0 : Number(row.quantity)-Number(row.returned_quantity)-Number(row.transferred_quantity)-Number(row.disposed_quantity);
}
function snapshot(row) {
  return { stock_item_id: String(row.stock_item_id), quantity: remaining(row), issued_date: row.issued_date, notes: row.notes };
}

// Serialize inventory transactions, including duplicate retries. Row locks and
// nonnegative balance constraints additionally protect every changed balance.
async function transaction(actorId, action, body, targets, fn, pool) {
  accessoryId(actorId, "บัญชีผู้ดำเนินการ");
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("ข้อมูลไม่ถูกต้อง");
  const key = requestId(body.request_id);
  const fingerprint = createHash("sha256").update(JSON.stringify({ actorId, action, targets, body })).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('accessory-inventory',0))");
    const prior = (await client.query("SELECT fingerprint,response FROM public.accessory_operations WHERE request_id=$1", [key])).rows[0];
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail("Request ID ถูกใช้กับรายการอื่นแล้ว", 409);
      await client.query("COMMIT");
      return prior.response;
    }
    const result = await fn(client, key);
    await client.query("INSERT INTO public.accessory_operations(request_id,actor_account_id,fingerprint,response) VALUES($1,$2,$3,$4::jsonb)", [key,actorId,fingerprint,JSON.stringify(result)]);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") fail("ข้อมูลนี้มีอยู่แล้ว กรุณาโหลดข้อมูลล่าสุด",409);
    throw error;
  } finally { client.release(); }
}
async function activeUser(client, userId) {
  const row = (await client.query('SELECT id FROM public."user" WHERE id=$1 AND is_active=true FOR SHARE', [accessoryId(userId,"พนักงาน")])).rows[0];
  if (!row) fail("ไม่พบพนักงานที่ Active");
}
async function activeType(client, typeId) {
  const row = (await client.query("SELECT id FROM public.accessory_types WHERE id=$1 AND is_active=true FOR SHARE", [accessoryId(typeId,"ประเภท")])).rows[0];
  if (!row) fail("ไม่พบประเภทที่ Active");
}
async function stockRow(client, id, active = false) {
  const row = (await client.query("SELECT id::text,accessory_type_id::text,brand,model,serial_number,available_quantity,version FROM public.accessory_stock_items WHERE id=$1 FOR UPDATE", [accessoryId(id,"รายการ Stock")])).rows[0];
  if (!row) fail("ไม่พบรายการ Stock",404);
  if (active) await activeType(client,row.accessory_type_id);
  return row;
}
async function holdingRow(client, userId, id, expectedVersion) {
  const row = (await client.query("SELECT *,id::text,user_id::text,stock_item_id::text,issued_date::text FROM public.employee_accessories WHERE id=$1 AND user_id=$2 FOR UPDATE", [accessoryId(id),accessoryId(userId)])).rows[0];
  if (!row) fail("ไม่พบรายการของพนักงาน",404);
  if (row.version !== version(expectedVersion) || remaining(row) <= 0) fail("รายการถูกเปลี่ยนหรือปิดแล้ว กรุณาโหลดใหม่",409);
  if (!row.stock_item_id) fail("รายการเดิมยังไม่เชื่อม Stock กรุณาตรวจข้อมูล",409);
  return row;
}
async function adjustStock(client, stock, delta) {
  if (stock.available_quantity + delta < 0) fail("Stock ไม่พอสำหรับจำนวนที่ระบุ",409);
  const row = (await client.query("UPDATE public.accessory_stock_items SET available_quantity=available_quantity+$2,version=version+1,updated_at=now() WHERE id=$1 AND available_quantity+$2>=0 RETURNING available_quantity,version", [stock.id,delta])).rows[0];
  if (!row) fail("Stock เปลี่ยนแล้ว กรุณาโหลดใหม่",409);
  Object.assign(stock,row);
}
async function movement(client, key, actorId, stock, data) {
  await client.query(`INSERT INTO public.accessory_stock_movements
    (stock_item_id,employee_accessory_id,related_accessory_id,action,quantity,stock_delta,balance_after,
     from_user_id,to_user_id,event_date,reason,notes,details,actor_account_id,request_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)`,
    [stock.id,data.issueId??null,data.relatedId??null,data.action,data.quantity,data.delta??0,stock.available_quantity,
      data.fromUser??null,data.toUser??null,data.date,data.reason,data.notes??null,JSON.stringify(data.details??{}),actorId,key]);
}
async function insertHolding(client, userId, stock, quantity, date, notes) {
  return (await client.query(`INSERT INTO public.employee_accessories
    (user_id,stock_item_id,accessory_type_id,quantity,brand,model,serial_number,issued_date,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text`,
    [userId,stock.id,stock.accessory_type_id,quantity,stock.brand,stock.model,stock.serial_number,date,notes])).rows[0].id;
}

export async function receiveAccessories(body, actorId, pool = getDbPool()) {
  return transaction(actorId,"receive",body,[],async(client,key)=>{
    const quantity = accessoryQuantity(body.quantity);
    const date = accessoryDate(body.event_date);
    const reason = accessoryText(body.reason,"ที่มาของการรับเข้า",500,true);
    const notes = accessoryText(body.notes,"หมายเหตุ",10000);
    let stock;
    if (body.stock_item_id) stock = await stockRow(client,body.stock_item_id,true);
    else {
      const typeId = accessoryId(body.accessory_type_id,"ประเภท");
      await activeType(client,typeId);
      const brand = accessoryText(body.brand,"ยี่ห้อ",150);
      const model = accessoryText(body.model,"รุ่น",150);
      const serial = accessoryText(body.serial_number,"Serial",200);
      await client.query("INSERT INTO public.accessory_stock_items(accessory_type_id,brand,model,serial_number) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [typeId,brand,model,serial]);
      const found = (await client.query(`SELECT id::text FROM public.accessory_stock_items WHERE accessory_type_id=$1
        AND lower(coalesce(brand,''))=lower(coalesce($2,'')) AND lower(coalesce(model,''))=lower(coalesce($3,''))
        AND lower(coalesce(serial_number,''))=lower(coalesce($4,''))`, [typeId,brand,model,serial])).rows[0];
      stock = await stockRow(client,found.id,true);
    }
    if (stock.serial_number) {
      const held = (await client.query("SELECT coalesce(sum(quantity-returned_quantity-transferred_quantity-disposed_quantity),0)::int AS quantity FROM public.employee_accessories WHERE stock_item_id=$1 AND returned_date IS NULL", [stock.id])).rows[0].quantity;
      if (quantity !== 1 || stock.available_quantity + held > 0) fail("รายการที่มี Serial รับได้ครั้งละ 1 ชิ้น และต้องไม่อยู่ในคลังหรือถูกถืออยู่แล้ว",409);
    }
    await adjustStock(client,stock,quantity);
    await movement(client,key,actorId,stock,{action:"receive",quantity,delta:quantity,date,reason,notes});
    return { stock_item_id:stock.id,available_quantity:stock.available_quantity };
  },pool);
}

export async function issueAccessories(userId, body, actorId, pool = getDbPool()) {
  userId = accessoryId(userId);
  return transaction(actorId,"issue",body,[userId],async(client,key)=>{
    await activeUser(client,userId);
    const stock = await stockRow(client,body.stock_item_id,true);
    const quantity = accessoryQuantity(body.quantity);
    const date = accessoryDate(body.issued_date);
    const notes = accessoryText(body.notes,"หมายเหตุ",10000);
    if (stock.serial_number && quantity !== 1) fail("รายการที่มี Serial ต้องมีจำนวน 1 ชิ้น");
    await adjustStock(client,stock,-quantity);
    const issueId = await insertHolding(client,userId,stock,quantity,date,notes);
    await movement(client,key,actorId,stock,{action:"issue",issueId,quantity,delta:-quantity,toUser:userId,date,reason:"เบิกให้พนักงาน",notes});
    return { id:issueId };
  },pool);
}

export async function changeAccessoryHolding(userId, issueId, action, body, actorId, pool = getDbPool()) {
  userId = accessoryId(userId); issueId = accessoryId(issueId);
  if (!["return","transfer","dispose","edit"].includes(action)) fail("การดำเนินการไม่ถูกต้อง");
  return transaction(actorId,action,body,[userId,issueId],async(client,key)=>{
    const row = await holdingRow(client,userId,issueId,body.expected_version);
    if (action !== "return") {
      const offboarding = await client.query(
        "SELECT 1 FROM public.employee_offboardings WHERE user_id=$1 AND closed_at IS NULL LIMIT 1",
        [userId],
      );
      if (offboarding.rowCount) fail("พนักงานอยู่ระหว่างตรวจคืนเมื่อลาออก กรุณารับคืนเข้าคลังก่อน",409);
    }
    const stock = await stockRow(client,row.stock_item_id);
    const date = accessoryDate(body.event_date);
    const notes = accessoryText(body.notes,"หมายเหตุ",10000);
    const reason = accessoryText(body.reason,"เหตุผล",500,action!=="return") || "คืนเข้าคลัง";
    if (date < row.issued_date) fail("วันที่ดำเนินการต้องไม่ก่อนวันที่เบิก");
    if (action === "edit") {
      const target = String(body.stock_item_id) === stock.id ? stock : await stockRow(client,body.stock_item_id,true);
      const quantity = accessoryQuantity(body.quantity);
      const issuedDate = accessoryDate(body.issued_date);
      if (target.serial_number && quantity !== 1) fail("รายการที่มี Serial ต้องมีจำนวน 1 ชิ้น");
      const earliest = (await client.query("SELECT min(event_date)::text AS date FROM public.accessory_stock_movements WHERE employee_accessory_id=$1 AND action IN ('return','transfer','dispose')",[issueId])).rows[0].date;
      if (earliest && issuedDate > earliest) fail("วันที่เบิกต้องไม่หลังประวัติคืน/โอน/ตัดออก");
      const held = remaining(row);
      if (target.id !== stock.id && row.returned_quantity+row.transferred_quantity+row.disposed_quantity > 0) {
        fail("รายการที่มีประวัติคืน/โอน/ตัดออกแล้ว เปลี่ยนชนิด Stock ไม่ได้ กรุณาคืนส่วนที่เหลือแล้วเบิกรายการใหม่");
      }
      if (target.id !== stock.id || quantity > held) {
        await activeUser(client,userId);
        await activeType(client,target.accessory_type_id);
      }
      if (target.id === stock.id) await adjustStock(client,stock,held-quantity);
      else { await adjustStock(client,stock,held); await adjustStock(client,target,-quantity); }
      await client.query(`UPDATE public.employee_accessories SET stock_item_id=$2,accessory_type_id=$3,
        brand=$4,model=$5,serial_number=$6,quantity=$7+returned_quantity+transferred_quantity+disposed_quantity,
        issued_date=$8,notes=$9,version=version+1,updated_at=now() WHERE id=$1`,
        [issueId,target.id,target.accessory_type_id,target.brand,target.model,target.serial_number,quantity,issuedDate,notes]);
      const details = { before:snapshot(row), after:{stock_item_id:target.id,quantity,issued_date:issuedDate,notes} };
      await movement(client,key,actorId,stock,{action,issueId,quantity:held,delta:target.id===stock.id?held-quantity:held,fromUser:userId,date,reason,notes,details});
      if (target.id!==stock.id) await movement(client,key,actorId,target,{action,issueId,quantity,delta:-quantity,toUser:userId,date,reason,notes,details});
      return { id:issueId };
    }
    const quantity = accessoryQuantity(body.quantity);
    if (quantity > remaining(row)) fail("จำนวนมากกว่าที่พนักงานถืออยู่",409);
    let relatedId = null;
    let targetUser = null;
    if (action === "transfer") {
      targetUser = accessoryId(body.to_user_id,"ผู้รับโอน");
      if (targetUser === userId) fail("ผู้รับโอนต้องเป็นพนักงานคนอื่น");
      await activeUser(client,targetUser);
      relatedId = await insertHolding(client,targetUser,stock,quantity,date,notes);
    }
    if (action === "return") await adjustStock(client,stock,quantity);
    const field = {return:"returned_quantity",transfer:"transferred_quantity",dispose:"disposed_quantity"}[action];
    const closes = quantity === remaining(row);
    await client.query(`UPDATE public.employee_accessories SET ${field}=${field}+$2,
      returned_date=CASE WHEN $3 THEN $4::date ELSE returned_date END,
      close_reason=CASE WHEN $3 THEN $5 ELSE close_reason END,
      version=version+1,updated_at=now() WHERE id=$1`, [issueId,quantity,closes,date,action]);
    await movement(client,key,actorId,stock,{action,issueId,relatedId,quantity,delta:action==="return"?quantity:0,fromUser:userId,toUser:targetUser,date,reason,notes});
    return { id:issueId,related_id:relatedId,remaining_quantity:remaining(row)-quantity };
  },pool);
}

export async function disposeStock(stockId, body, actorId, pool = getDbPool()) {
  stockId = accessoryId(stockId);
  return transaction(actorId,"dispose-stock",body,[stockId],async(client,key)=>{
    const stock = await stockRow(client,stockId);
    if (stock.version !== version(body.expected_version)) fail("Stock เปลี่ยนแล้ว กรุณาโหลดใหม่",409);
    const quantity = accessoryQuantity(body.quantity);
    const date = accessoryDate(body.event_date);
    const reason = accessoryText(body.reason,"เหตุผลที่นำออก",500,true);
    const notes = accessoryText(body.notes,"หมายเหตุ",10000);
    await adjustStock(client,stock,-quantity);
    await movement(client,key,actorId,stock,{action:"dispose",quantity,delta:-quantity,date,reason,notes});
    return { stock_item_id:stock.id,available_quantity:stock.available_quantity };
  },pool);
}

export async function editStockItem(stockId, body, actorId, pool = getDbPool()) {
  stockId = accessoryId(stockId);
  return transaction(actorId,"edit-stock",body,[stockId],async(client,key)=>{
    const stock = await stockRow(client,stockId);
    if (stock.version !== version(body.expected_version)) fail("Stock เปลี่ยนแล้ว กรุณาโหลดใหม่",409);
    const typeId = accessoryId(body.accessory_type_id,"ประเภท");
    await activeType(client,typeId);
    const brand = accessoryText(body.brand,"ยี่ห้อ",150);
    const model = accessoryText(body.model,"รุ่น",150);
    const serial = accessoryText(body.serial_number,"Serial",200);
    const reason = accessoryText(body.reason,"เหตุผลแก้ไข",500,true);
    const date = accessoryDate(body.event_date);
    const held = (await client.query("SELECT coalesce(sum(quantity-returned_quantity-transferred_quantity-disposed_quantity),0)::int AS quantity FROM public.employee_accessories WHERE stock_item_id=$1 AND returned_date IS NULL",[stockId])).rows[0].quantity;
    if (serial && held+stock.available_quantity>1) fail("Stock หลายชิ้นต้องไม่ใช้ Serial เดียวกัน");
    const before = {...stock};
    await client.query("UPDATE public.accessory_stock_items SET accessory_type_id=$2,brand=$3,model=$4,serial_number=$5,version=version+1,updated_at=now() WHERE id=$1",[stockId,typeId,brand,model,serial]);
    await client.query("UPDATE public.employee_accessories SET accessory_type_id=$2,brand=$3,model=$4,serial_number=$5,version=version+1,updated_at=now() WHERE stock_item_id=$1 AND returned_date IS NULL",[stockId,typeId,brand,model,serial]);
    await movement(client,key,actorId,stock,{action:"edit",quantity:0,date,reason,details:{before,after:{accessory_type_id:typeId,brand,model,serial_number:serial}}});
    return { stock_item_id:stockId };
  },pool);
}
