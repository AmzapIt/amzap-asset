import { query } from "./db.js";

// สวิตช์เปิด/ปิดปุ่ม "วางข้อมูลจากสคริปต์" ในหน้าแก้ไข Asset
// เก็บใน app_settings (migration 031) จึงใช้ค่าเดียวกันทั้ง local server และ Vercel
const MACHINE_SPECS_KEY = "assets.machine_specs_enabled";

export async function getMachineSpecsEnabled(db = { query }) {
  try {
    const result = await db.query("SELECT value FROM public.app_settings WHERE key=$1", [MACHINE_SPECS_KEY]);
    return result.rows[0]?.value === "true";
  } catch (error) {
    if (error.code === "42P01") return false;
    throw error;
  }
}

export async function saveMachineSpecsEnabled(enabled, accountId, db = { query }) {
  if (typeof enabled !== "boolean") throw new TypeError("enabled must be boolean");
  await db.query(
    "INSERT INTO public.app_settings (key,value,updated_at,updated_by_account_id) VALUES ($1,$2,now(),$3) " +
    "ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by_account_id=EXCLUDED.updated_by_account_id",
    [MACHINE_SPECS_KEY, String(enabled), accountId],
  );
  return enabled;
}
