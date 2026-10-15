import { query } from "@/lib/db";
import {
  getCurrentAccessories,
  getReportAssets,
} from "@/lib/asset-report";
import ExportPanel from "../ExportPanel";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// หน้าใบรับมอบต้องอ่าน Asset, พนักงาน และ Accessory ที่ยังไม่คืนพร้อมกัน
// เพื่อแสดงของที่พนักงานถืออยู่จริงก่อนส่งคำขอสร้าง PDF ไปยัง Server
export default async function HandoverReportsPage() {
  let accessories;
  let assets;
  let users;

  try {
    [assets, users, accessories] = await Promise.all([
      getReportAssets(),
      query(`
        SELECT
          u.id::text AS id,
          u.employee_code,
          u.full_name,
          u.nickname,
          u.is_active,
          l.name AS location_name,
          CASE WHEN u.is_active THEN 1 ELSE 0 END AS status
        FROM public."user" u
        LEFT JOIN public.locations l ON l.id=u.location_id
        ORDER BY u.full_name
      `),
      getCurrentAccessories(),
    ]);
  } catch (error) {
    console.error("Handover reports load failed", error);
    return <ReportLoadError retryHref="/reports/handover" />;
  }

  return (
    <ReportsShell
      view="handover"
      title="Asset & Accessory Handover"
      description="จัดทำใบรับมอบจากผู้ครอบครองปัจจุบัน พร้อม Accessory ที่ยังไม่คืน"
    >
      <ExportPanel
        accessories={accessories}
        assets={assets}
        users={users.rows}
        view="handover"
      />
    </ReportsShell>
  );
}
