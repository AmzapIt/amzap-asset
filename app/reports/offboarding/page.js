import { redirect } from "next/navigation";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import { getOffboardingPendingReport } from "@/lib/report-center";
import ReportTable from "../ReportTable";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { key: "employee_name", label: "พนักงาน" },
  { key: "employee_code", label: "รหัสพนักงาน" },
  { key: "department_name", label: "แผนก" },
  { key: "started_at_label", label: "วันที่เริ่มลาออก" },
  { key: "started_by", label: "ผู้เริ่มรายการ" },
  { key: "item_type_label", label: "ชนิดรายการ" },
  { key: "item_name", label: "อุปกรณ์" },
  { key: "expected_quantity", label: "จำนวนที่ต้องคืน" },
  { key: "received_quantity", label: "คืนแล้ว" },
  { key: "pending_quantity", label: "ค้างคืน" },
  { key: "review_label", label: "ตรวจสอบผู้ถือ" },
  { key: "resolution_reason", label: "ผลตรวจสอบ" },
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export default async function OffboardingReportPage() {
  const account = await workflowPageAccount();
  if (!account.canWrite) redirect("/");
  let rows;
  try {
    rows = await getOffboardingPendingReport();
  } catch (error) {
    console.error("Offboarding report load failed", error);
    return <ReportLoadError retryHref="/reports/offboarding" />;
  }
  const reportRows = rows.map((row) => ({
    ...row,
    id: row.item_id,
    started_at_label: formatDate(row.started_at),
    item_type_label: row.item_type === "asset" ? "Asset" : "Accessories",
    review_label: row.resolution_reason || (row.requires_review ? "ต้องตรวจสอบผู้ถือจริง" : ""),
  }));

  return (
    <ReportsShell view="offboarding" canViewOperational title="รายการลาออกที่ยังคืนของไม่ครบ"
      description="แสดงรายการอุปกรณ์ที่ยังค้างคืนในเคสลาออกที่เปิดอยู่ พร้อมจำนวน ผู้เริ่มรายการ และทางลัดไปตรวจต่อ">
      <ReportTable rows={reportRows} columns={columns} filename="AMZAP-รายการลาออกค้างคืน.csv"
        filterField="item_type" filterLabel="ชนิดรายการ"
        filterOptions={[{ value: "asset", label: "Asset" }, { value: "accessory", label: "Accessories" }]}
        linkField="employee_name" linkLabel="เปิดรายการคืนของ" linkTargetField="user_id"
        linkPrefix="/users/" linkSuffix="#offboarding" />
    </ReportsShell>
  );
}
