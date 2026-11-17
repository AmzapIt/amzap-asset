import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getCurrentAccessories, getReportAssets } from "@/lib/asset-report";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import ReportTable from "../ReportTable";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { key: "employee_name", label: "พนักงาน" },
  { key: "employee_code", label: "รหัสพนักงาน" },
  { key: "department_name", label: "แผนก" },
  { key: "asset_count", label: "Asset ที่ถือ" },
  { key: "accessory_count", label: "Accessory ที่ถือ (ชิ้น)" },
];

// พิมพ์ใบคืนแบบกรอกมือในวันสุดท้ายของพนักงาน: แสดงเฉพาะพนักงาน Active ที่ยังถือของอยู่
// ไม่ต้องเริ่มเคสลาออกก่อน และพนักงานที่ปิดสถานะแล้วไม่แสดงในหน้านี้
export default async function ReturnFormsPage() {
  const account = await workflowPageAccount();
  if (!account.canWrite) redirect("/");
  let assets;
  let accessories;
  let users;
  try {
    [assets, accessories, users] = await Promise.all([
      getReportAssets(),
      getCurrentAccessories(),
      query(`
        SELECT u.id::text AS id,u.employee_code,u.full_name,u.nickname,d.name AS department_name
        FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id
        WHERE u.is_active ORDER BY u.full_name
      `),
    ]);
  } catch (error) {
    console.error("Return form list load failed", error);
    return <ReportLoadError retryHref="/reports/return-forms" />;
  }

  const assetCount = new Map();
  for (const asset of assets) {
    if (asset.current_holder_id) assetCount.set(asset.current_holder_id, (assetCount.get(asset.current_holder_id) || 0) + 1);
  }
  const accessoryCount = new Map();
  for (const item of accessories) {
    accessoryCount.set(item.user_id, (accessoryCount.get(item.user_id) || 0) + Number(item.quantity));
  }
  const rows = users.rows
    .map((user) => ({
      ...user,
      user_id: user.id,
      employee_name: user.nickname?.trim() ? `${user.full_name} (${user.nickname.trim()})` : user.full_name,
      asset_count: assetCount.get(user.id) || 0,
      accessory_count: accessoryCount.get(user.id) || 0,
    }))
    .filter((row) => row.asset_count > 0 || row.accessory_count > 0);

  return (
    <ReportsShell view="return-forms" canViewOperational title="ใบคืนทรัพย์สิน (ลาออก)"
      description="พิมพ์ใบคืนในวันสุดท้ายของพนักงาน ตรวจนับของจริงแล้วกรอกผลและลงนามด้วยมือ จากนั้นคีย์รับคืนในระบบตามใบ">
      <ReportTable rows={rows} columns={columns} filename="AMZAP-พนักงานที่ถือทรัพย์สิน.csv"
        linkField="employee_name" linkLabel="เปิดหน้าพนักงาน" linkTargetField="user_id"
        linkPrefix="/users/" extraLinkLabel="พิมพ์ใบคืน" extraLinkPrefix="/api/users/"
        extraLinkSuffix="/return-form" />
    </ReportsShell>
  );
}
