// ประเภทย่อยของ Asset (migration 035) เช่น NET -> Firewall, OTH -> License
// ไม่อยู่ในรหัส Asset จึงเปลี่ยนภายหลังได้ · ปิดใช้แทนการลบ ให้ Asset เดิมยังอ้างถึงได้
import { AssetWorkflowError } from "./asset-scan.js";

const ID = /^[1-9]\d{0,18}$/;

function validId(value) {
  return typeof value === "string" && ID.test(value) && BigInt(value) <= 9223372036854775807n;
}

// "" / null = ไม่ระบุประเภทย่อย
export function parseSubtypeId(value) {
  if (value == null || value === "") return null;
  if (!validId(value)) throw new AssetWorkflowError("ประเภทย่อยไม่ถูกต้อง");
  return value;
}

// ประเภทย่อยต้องอยู่ในประเภทหลักของ Asset และเปิดใช้อยู่
// ยกเว้นค่าเดิมของ Asset ที่ถูกปิดไปภายหลัง ยังบันทึกซ้ำได้
export async function validateAssetSubtype(db, subtypeId, assetTypeId, currentSubtypeId = null) {
  if (subtypeId == null) return null;
  const row = (await db.query(
    "SELECT id::text, asset_type_id::text, is_active FROM public.asset_subtypes WHERE id=$1",
    [subtypeId],
  )).rows[0];
  if (!row || row.asset_type_id !== String(assetTypeId)) {
    throw new AssetWorkflowError("ประเภทย่อยไม่ตรงกับ Asset Type");
  }
  if (!row.is_active && String(currentSubtypeId ?? "") !== row.id) {
    throw new AssetWorkflowError("ประเภทย่อยนี้ถูกปิดใช้งานแล้ว");
  }
  return row.id;
}

export async function listAssetSubtypes(db) {
  return (await db.query(
    `SELECT s.id::text, s.asset_type_id::text, s.name, s.is_active, s.sort_order,
            t.name AS asset_type, t.prefix, t.is_active AS asset_type_active,
            (SELECT count(*) FROM public.assets a WHERE a.subtype_id=s.id)::int AS asset_count
       FROM public.asset_subtypes s
       JOIN public.asset_types t ON t.id=s.asset_type_id
      ORDER BY t.prefix, s.sort_order, lower(s.name), s.id`,
  )).rows;
}

// ข้อมูลจากหน้า Settings: { id?, assetTypeId, name, isActive, sortOrder }
// แก้ไขได้เฉพาะชื่อ ลำดับ และสถานะ · ย้ายไปประเภทอื่นไม่ได้ เพราะ Asset ที่ใช้อยู่จะผิดประเภท
export function parseSubtypeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AssetWorkflowError("ข้อมูลคำขอไม่ถูกต้อง");
  }
  const id = body.id == null || body.id === "" ? null : body.id;
  if (id !== null && !validId(id)) throw new AssetWorkflowError("รายการไม่ถูกต้อง");
  if (id === null && !validId(body.assetTypeId)) throw new AssetWorkflowError("กรุณาเลือก Asset Type");

  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new AssetWorkflowError("กรุณากรอกชื่อประเภทย่อย");
  if (name.length > 100) throw new AssetWorkflowError("ชื่อประเภทย่อยยาวได้ไม่เกิน 100 ตัวอักษร");

  if (typeof body.isActive !== "boolean") throw new AssetWorkflowError("ข้อมูลสถานะไม่ถูกต้อง");
  const sortOrder = body.sortOrder == null || body.sortOrder === "" ? 0 : Number(body.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    throw new AssetWorkflowError("ลำดับต้องเป็นเลข 0-999");
  }
  return { id, assetTypeId: id === null ? body.assetTypeId : null, name, isActive: body.isActive, sortOrder };
}

export async function saveAssetSubtype(db, input) {
  try {
    if (input.id) {
      const row = (await db.query(
        `UPDATE public.asset_subtypes SET name=$2, is_active=$3, sort_order=$4, updated_at=now()
          WHERE id=$1 RETURNING id::text`,
        [input.id, input.name, input.isActive, input.sortOrder],
      )).rows[0];
      if (!row) throw new AssetWorkflowError("ไม่พบประเภทย่อย", 404);
      return row.id;
    }
    const type = (await db.query("SELECT is_active FROM public.asset_types WHERE id=$1", [input.assetTypeId])).rows[0];
    if (!type) throw new AssetWorkflowError("ไม่พบ Asset Type");
    if (!type.is_active) throw new AssetWorkflowError("Asset Type นี้ถูกปิดใช้งาน");
    return (await db.query(
      `INSERT INTO public.asset_subtypes (asset_type_id, name, is_active, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING id::text`,
      [input.assetTypeId, input.name, input.isActive, input.sortOrder],
    )).rows[0].id;
  } catch (error) {
    if (error.code === "23505") throw new AssetWorkflowError("ชื่อนี้มีอยู่แล้วใน Asset Type เดียวกัน", 409);
    throw error;
  }
}
