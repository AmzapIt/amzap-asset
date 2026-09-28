import { query } from "@/lib/db";
import { getReportAssets } from "@/lib/asset-report";
import ExportPanel from "../ExportPanel";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// หน้า Asset Export โหลดเฉพาะ Asset และรายชื่อพนักงานที่ใช้เป็นตัวกรอง
// ไม่อ่าน Accessory เพราะข้อมูลส่วนนั้นใช้เฉพาะหน้าใบรับมอบ
export default async function AssetReportsPage() {
  let assets;
  let users;

  try {
    [assets, users] = await Promise.all([
      getReportAssets(),
      query(`
        SELECT
          id::text AS id,
          employee_code,
          full_name,
          nickname,
          is_active,
          CASE WHEN is_active THEN 1 ELSE 0 END AS status
        FROM public."user"
        ORDER BY full_name
      `),
    ]);
  } catch (error) {
    console.error("Asset reports load failed", error);
    return <ReportLoadError retryHref="/reports/assets" />;
  }

  return (
    <ReportsShell
      view="assets"
      title="Asset Export"
      description="กรองและส่งออกรายการ Asset เป็น Excel หรือ PDF"
    >
      <ExportPanel
        accessories={[]}
        assets={assets}
        users={users.rows}
        view="assets"
      />
    </ReportsShell>
  );
}
