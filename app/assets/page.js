import Link from "next/link";
import { query } from "@/lib/db";
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
    // ==================================================
    // 3. Query ข้อมูลจริง
    // JOIN asset_types เพื่อเอาชื่อประเภทมาแสดง
    // ==================================================
    const result = await query(`
            SELECT
            a.id,
            a.asset_code,
            a.asset_name,
            a.brand,
            a.model,
            a.serial_number,
            a.status,

            -- วันที่รับเข้า ไม่ใช่วันที่ซื้อ
            TO_CHAR(
              a.received_date,
              'DD/MM/YYYY'
            ) AS received_date,

            -- ชื่อประเภท เช่น Monitor / Notebook
            t.name AS asset_type,

            -- ใช้ชื่อจาก user ที่อ้างอิงด้วย asset_owner_id เป็นหลัก
            -- ถ้ายังไม่มี ให้แสดงผู้รับมอบหมายปัจจุบันแทน
            COALESCE(
              NULLIF(u.full_name, ''),
              NULLIF(legacy_owner.full_name, ''),
              CASE WHEN a.asset_owner_id IS NULL
                AND btrim(a.asset_owner_name) !~ '^[0-9]+$'
                THEN NULLIF(btrim(a.asset_owner_name), '') END,
              p.full_name
            ) AS current_holder,

            -- สถานที่ของรายการมอบหมาย ถ้าไม่มีใช้สถานที่ของ Asset
            l.name AS location

          FROM assets a

          JOIN asset_types t
            ON t.id = a.asset_type_id

          -- Owner ทั้ง Active และ Inactive ต้องแสดงชื่อได้ จึงไม่กรอง status
          LEFT JOIN public."user" u
            ON u.id = a.asset_owner_id

          -- รองรับข้อมูลเก่าที่หน้า Add เคยเก็บ user.id ใน asset_owner_name
          -- ใช้เฉพาะเมื่อยังไม่มี asset_owner_id และไม่แก้ไขข้อมูลในฐานข้อมูล
          LEFT JOIN public."user" legacy_owner
            ON a.asset_owner_id IS NULL
           AND legacy_owner.id::text = btrim(a.asset_owner_name)

          -- รายการมอบหมายปัจจุบัน
          LEFT JOIN asset_assignments aa
            ON aa.asset_id = a.id
          AND aa.returned_date IS NULL

          -- ชื่อผู้ครอบครอง
          LEFT JOIN people p
            ON p.id = aa.assigned_to

          -- สถานที่ปัจจุบัน
          LEFT JOIN locations l
            ON l.id = COALESCE(aa.location_id, a.location_id)

          ORDER BY a.id DESC
    `);

    // rows คือ Array ของข้อมูลที่ PostgreSQL ส่งกลับมา
    assets = result.rows;

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