import Link from "next/link";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import AssetSubtypeManager from "./AssetSubtypeManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Master Data: ประเภทย่อยของ Asset (เช่น NET -> Firewall)
// ทุกคนที่ล็อกอินดูได้ · เพิ่ม/แก้ไขได้เฉพาะ Admin (API ตรวจสิทธิ์ซ้ำ)
export default async function AssetSubtypesPage() {
  const account = await workflowPageAccount();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-6 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">Configuration</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Asset Subtypes</h1>
          <p className="mt-2 text-blue-100">ประเภทย่อยของอุปกรณ์ เช่น NET → Firewall, OTH → License</p>
        </header>

        <Link href="/settings?tab=master" className="mb-5 inline-flex min-h-10 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">
          ← กลับไป Settings / Master Data
        </Link>

        <AssetSubtypeManager canEdit={account.role === "Admin"} />
      </div>
    </main>
  );
}
