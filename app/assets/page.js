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
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* ==========================================
            HEADER
        ========================================== */}
        <header className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
              Inventory & equipment
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Assets
            </h1>

            <p className="mt-2 text-blue-100">
              จัดการข้อมูลทรัพย์สิน IT
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
            <Link
              href="/reports"
              className="rounded-lg border border-white/30 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Export / ใบรับมอบ
            </Link>
            <Link
              href="/assets/add"
              className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50"
            >
              + รับเครื่องใหม่เข้าคลัง IT
            </Link>
          </div>
        </header>

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
