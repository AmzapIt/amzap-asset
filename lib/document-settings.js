import { query } from "./db.js";

const IT_SIGNER_KEY = "document.it_signer_name";
export const IT_SIGNER_MAX = 100;

export class DocumentSettingsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ชื่อผู้เซ็นฝั่ง IT ที่พิมพ์ลงเอกสารทุกชนิด (ใบคืน ใบรับมอบ ใบขอเบิก ใบตรวจยืนยัน)
// ถ้ายังไม่รัน migration 031 หรือยังไม่ตั้งค่า จะคืน "" และเอกสารเว้นช่องชื่อว่างเหมือนเดิม
export async function getItSignerName(db = { query }) {
  try {
    const result = await db.query("SELECT value FROM public.app_settings WHERE key=$1", [IT_SIGNER_KEY]);
    return result.rows[0]?.value ?? "";
  } catch (error) {
    if (error.code === "42P01") return "";
    throw error;
  }
}

export function validateItSignerName(value) {
  if (typeof value !== "string") throw new DocumentSettingsError("ชื่อไม่ถูกต้อง");
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length > IT_SIGNER_MAX) throw new DocumentSettingsError(`ชื่อยาวได้ไม่เกิน ${IT_SIGNER_MAX} ตัวอักษร`);
  return name;
}

export async function saveItSignerName(value, accountId, db = { query }) {
  const name = validateItSignerName(value);
  try {
    await db.query(
      "INSERT INTO public.app_settings (key,value,updated_at,updated_by_account_id) VALUES ($1,$2,now(),$3) " +
      "ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by_account_id=EXCLUDED.updated_by_account_id",
      [IT_SIGNER_KEY, name, accountId],
    );
  } catch (error) {
    if (error.code === "42P01") throw new DocumentSettingsError("ยังไม่ได้เตรียมฐานข้อมูล กรุณารัน migrations/031-app-settings.sql ก่อน", 503);
    throw error;
  }
  return name;
}
