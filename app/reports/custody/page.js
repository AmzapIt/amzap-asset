import { redirect } from "next/navigation";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import { getCustodyReport } from "@/lib/report-center";
import ReportTable from "../ReportTable";
import ReportsShell, { ReportLoadError } from "../ReportsShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { key: "asset_code", label: "Asset Code" },
  { key: "asset_name", label: "ชื่อ Asset" },
  { key: "holder_name", label: "ผู้ถือครอง" },
  { key: "department_name", label: "แผนก" },
  { key: "location_name", label: "สถานที่ ณ ตอนเบิก" },
  { key: "assigned_date", label: "วันที่เบิก" },
  { key: "issue_actor", label: "ผู้บันทึกเบิก" },
  { key: "issue_reason", label: "หมายเหตุเบิก" },
  { key: "returned_date", label: "วันที่คืน" },
  { key: "returned_by_name", label: "ผู้ส่งคืน" },
  { key: "return_actor", label: "IT ผู้รับคืน" },
  { key: "return_reason", label: "เหตุผลคืน" },
  { key: "period_status_label", label: "สถานะรายการ" },
  { key: "source", label: "แหล่งข้อมูล" },
];

export default async function CustodyReportPage() {
  const account = await workflowPageAccount();
  if (!account.canWrite) redirect("/");
  let rows;
  try {
    rows = await getCustodyReport();
  } catch (error) {
    console.error("Custody report load failed", error);
    return <ReportLoadError retryHref="/reports/custody" />;
  }
  const reportRows = rows.map((row) => ({
    ...row,
    period_status_label: row.period_status === "current" ? "ยังถืออยู่" : "คืนแล้ว",
  }));

  return (
    <ReportsShell view="custody" canViewOperational title="ผู้ถือครองและประวัติเบิก–คืน"
      description="สรุปการถือครองปัจจุบันและประวัติการเบิกคืน Asset พร้อมผู้ทำรายการ เหตุผล และวันที่">
      <ReportTable rows={reportRows} columns={columns} filename="AMZAP-ประวัติเบิกคืน.csv"
        filterField="period_status" filterLabel="สถานะการถือครอง"
        filterOptions={[{ value: "current", label: "ยังถืออยู่" }, { value: "returned", label: "คืนแล้ว" }]}
        linkField="asset_code" linkLabel="เปิด Asset" linkTargetField="asset_id" linkPrefix="/assets/" />
    </ReportsShell>
  );
}
