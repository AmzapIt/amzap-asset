import { query } from "@/lib/db";
import {
  getCurrentAccessories,
  getReportAssets,
} from "@/lib/asset-report";
import ExportPanel from "../ExportPanel";
import { getItSignerName } from "@/lib/document-settings";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// หน้าใบรับมอบต้องอ่าน Asset, พนักงาน และ Accessory ที่ยังไม่คืนพร้อมกัน
// เพื่อแสดงของที่พนักงานถืออยู่จริงก่อนส่งคำขอสร้าง PDF ไปยัง Server
export default async function HandoverReportsPage({ searchParams }) {
  let accessories;
  let assets;
  let users;
  let itSignerName = "";

  try {
    [assets, users, accessories, itSignerName] = await Promise.all([
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
      getItSignerName(),
    ]);
  } catch (error) {
    console.error("Handover reports load failed", error);
    return <ReportLoadError retryHref="/reports/handover" />;
  }

  const params = await searchParams;
  const userId = typeof params?.userId === "string" && users.rows.some((u) => u.id === params.userId && u.is_active) ? params.userId : "";
  const ids = typeof params?.assetIds === "string" ? params.assetIds.split(",") : [];
  const initialAssetIds = assets.filter((a) => a.current_holder_id === userId && ids.includes(a.id)).slice(0, 7).map((a) => a.id);

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
        initialRecipient={userId}
        initialAssetIds={initialAssetIds}
        defaultDeliveredBy={itSignerName}
        view="handover"
      />
    </ReportsShell>
  );
}
