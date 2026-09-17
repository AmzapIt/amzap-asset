import Link from "next/link";
import { getReportAssets } from "@/lib/asset-report";
import AssetTable from "./AssetTable";

// ==================================================
// 1. ให้หน้านี้ทำงานบน Node.js
// เพราะใช้ pg เชื่อม PostgreSQL
// ==================================================
export const runtime = "nodejs";

// ให้ดึงข้อมูลใหม่เมื่อมี Request เข้ามา
export const dynamic = "force-dynamic";

// ==================================================
// 2. Server Component
// ทำหน้าที่อ่านข้อมูลจาก PostgreSQL
// ==================================================
export default async function AssetsPage() {
  let assets = [];
  let loadError = false;

  try {
    // ใช้ข้อมูลชุดเดียวกับ Export และแปลงวันที่เฉพาะเพื่อแสดงในตารางเดิม
    assets = (await getReportAssets()).map(asset => ({
      ...asset,
      received_date: asset.received_date ? asset.received_date.split("-").reverse().join("/") : null,
    }));

  } catch (error) {
    // แสดง Error จริงใน Terminal ฝั่ง Server
    console.error("Load assets error:", error);

    // ใช้แสดงข้อความบนหน้าเว็บ
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* ==========================================
            HEADER
        ========================================== */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Assets
            </h1>

            <p className="mt-2 text-gray-500">
              จัดการข้อมูลทรัพย์สิน IT
            </p>
          </div>

          <Link href="/reports" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold">Export / ใบรับมอบ</Link>
          {/* ไปหน้า Add Asset ที่เราทำไว้แล้ว */}
          <Link
            href="/assets/add"
            className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            + Add Asset
          </Link>
        </div>

        {/* ==========================================
            ASSET LIST
        ========================================== */}
        {loadError ? (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            ไม่สามารถโหลดข้อมูลจาก PostgreSQL ได้
            กรุณาตรวจสอบ Terminal
          </div>
        ) : (
          // ส่ง Array จาก PostgreSQL ไปให้ Client Component
          <AssetTable assets={assets} />
        )}
      </div>
    </main>
  );
}