import Link from "next/link";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import { getMachineSpecsEnabled } from "@/lib/machine-specs-settings";
import SpecsImport from "./SpecsImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// นำเข้าไฟล์ .json จากสคริปต์ตรวจเครื่อง (รันจาก USB) ทีละหลายเครื่อง จับคู่ Asset ด้วย Serial
export default async function SpecsImportPage() {
  const account = await workflowPageAccount();
  const enabled = await getMachineSpecsEnabled().catch(() => false);
  const blocked = !account.canWrite
    ? "บัญชีนี้ดูข้อมูลได้อย่างเดียว นำเข้าได้เฉพาะ Admin และ IT Staff"
    : !enabled
      ? "ฟีเจอร์สคริปต์ตรวจเครื่องปิดอยู่ ให้ Admin เปิดที่ Settings → สคริปต์ตรวจเครื่อง"
      : "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">Machine specs</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">นำเข้าสเปกเครื่อง</h1>
          <p className="mt-2 text-blue-100">นำไฟล์ .json จากโฟลเดอร์ specs ที่สคริปต์บันทึกไว้ มาอัปเดต Technical Information และ Software</p>
        </header>

        {blocked ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{blocked}</p>
        ) : (
          <SpecsImport />
        )}

        <Link href="/settings?tab=machine" className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-4 font-medium text-blue-700 hover:bg-blue-50">
          กลับไปหน้าตั้งค่าสคริปต์ตรวจเครื่อง
        </Link>
      </div>
    </main>
  );
}
