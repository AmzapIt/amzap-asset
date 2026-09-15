"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// ==================================================
// 1. สีของ Status
// ใช้แสดงสถานะให้อ่านง่ายขึ้น
// ==================================================
const statusColors = {
  "In Stock": "bg-blue-100 text-blue-800",
  "In Use": "bg-green-100 text-green-800",
  Repair: "bg-yellow-100 text-yellow-800",
  Spare: "bg-purple-100 text-purple-800",
  Retired: "bg-gray-200 text-gray-700",
  Disposed: "bg-gray-200 text-gray-700",
  Lost: "bg-red-100 text-red-800",
};

// ==================================================
// 2. Component รับข้อมูลจากหน้า Assets
// assets คือ Array ที่ PostgreSQL ส่งมา
// ==================================================
export default function AssetTable({ assets }) {
  // เก็บข้อความที่ผู้ใช้พิมพ์ค้นหา
  const [searchText, setSearchText] = useState("");

  // เก็บประเภทที่เลือก เช่น Monitor
  const [selectedType, setSelectedType] = useState("");

  // เก็บสถานะที่เลือก เช่น In Use
  const [selectedStatus, setSelectedStatus] = useState("");

    // ใช้เปลี่ยนหน้าเมื่อผู้ใช้คลิกแถว
  const router = useRouter();
  // ==================================================
  // 3. สร้างรายการประเภทจากข้อมูลจริง
  // Set ใช้ตัดชื่อประเภทที่ซ้ำกันออก
  // ==================================================
  const assetTypes = [
    ...new Set(assets.map((asset) => asset.asset_type)),
  ].sort();

  // ==================================================
  // 4. กรองข้อมูลด้วย JavaScript
  // ไม่ได้แก้หรือลบข้อมูลใน PostgreSQL
  // ==================================================
  const filteredAssets = assets.filter((asset) => {
    // แปลงข้อความค้นหาเป็นตัวพิมพ์เล็ก
    const keyword = searchText.toLowerCase().trim();

    // ค้นหาจากหลาย Field
    const matchesSearch =
      !keyword ||
      [
        asset.asset_code,
        asset.asset_name,
        asset.brand,
        asset.model,
        asset.serial_number,
        asset.current_holder,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(keyword)
      );

    // ถ้ายังไม่เลือกประเภท ให้ผ่านทั้งหมด
    const matchesType =
      !selectedType || asset.asset_type === selectedType;

    // ถ้ายังไม่เลือกสถานะ ให้ผ่านทั้งหมด
    const matchesStatus =
      !selectedStatus || asset.status === selectedStatus;

    // ต้องตรงกับเงื่อนไขทั้งหมด
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ==========================================
          SEARCH & FILTER
      ========================================== */}
      <div className="grid grid-cols-1 gap-4 border-b border-slate-200 p-5 md:grid-cols-[2fr_1fr_1fr]">
        {/* ช่องค้นหา */}
        <div>
          <label
            htmlFor="assetSearch"
            className="mb-2 block text-sm font-medium"
          >
            Search
          </label>

          <input
            id="assetSearch"
            type="text"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="ค้นหารหัส, ชื่อทรัพย์สิน, Serial, ผู้ครอบครอง..."
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* กรองประเภท */}
        <div>
          <label
            htmlFor="typeFilter"
            className="mb-2 block text-sm font-medium"
          >
            Asset Type
          </label>

          <select
            id="typeFilter"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(event.target.value)
            }
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Types</option>

            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* กรองสถานะ */}
        <div>
          <label
            htmlFor="statusFilter"
            className="mb-2 block text-sm font-medium"
          >
            Status
          </label>

          <select
            id="statusFilter"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value)
            }
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Statuses</option>

            {Object.keys(statusColors).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* จำนวนรายการหลังกรอง */}
      <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
        Showing {filteredAssets.length} of {assets.length} assets
      </div>

      {/* ==========================================
          ASSET TABLE
      ========================================== */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">รหัสทรัพย์สิน</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">ประเภทอุปกรณ์</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">ชื่อทรัพย์สิน</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">ยี่ห้อ / รุ่น</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">ผู้ครอบครอง</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">Location</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">สถานะ</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500">วันที่รับเข้า</th>
            </tr>
          </thead>

          <tbody>
            {/* สร้างแถวจากข้อมูลที่ผ่าน Search / Filter แล้ว */}
            {filteredAssets.map((asset) => (
                <tr
                key={asset.id}
                className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/50"

                // คลิกตรงไหนของแถวก็เปิด Detail ของ Asset นั้น
                onClick={() => router.push(`/assets/${asset.id}`)}
                >
                {/* รหัสทรัพย์สิน */}
                <td className="whitespace-nowrap px-5 py-5 font-semibold text-slate-900">
                    {/* ลิงก์จริงรองรับคีย์บอร์ดและเปิดแท็บใหม่ได้ แม้ทั้งแถวจะคลิกได้ */}
                    <Link href={`/assets/${asset.id}`} onClick={(event) => event.stopPropagation()} className="rounded hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500">
                      {asset.asset_code}
                    </Link>
                </td>

                {/* ประเภท */}
                <td className="px-5 py-5 text-slate-700">
                    {asset.asset_type}
                </td>

                {/* ชื่อทรัพย์สิน */}
                <td className="px-5 py-5 text-slate-700">
                    {asset.asset_name}
                </td>

                {/* ยี่ห้อ / รุ่น */}
                <td className="px-5 py-5 text-slate-700">
                    {asset.brand || "-"}
                    {asset.model ? ` / ${asset.model}` : ""}
                </td>

                {/* ผู้ครอบครองปัจจุบัน */}
                <td className="px-5 py-5 text-slate-700">
                    {asset.current_holder || "-"}
                </td>

                {/* สถานที่ */}
                <td className="px-5 py-5 text-slate-700">
                    {asset.location || "-"}
                </td>

                {/* สถานะ */}
                <td className="px-5 py-5 text-slate-700">
                    <span
                    className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                        statusColors[asset.status] ||
                        "bg-gray-100 text-gray-700"
                    }`}
                    >
                    {asset.status}
                    </span>
                </td>

                {/* วันที่รับเข้า: เก็บวันเดือนปีในบรรทัดเดียว */}
                <td className="whitespace-nowrap px-5 py-5 text-slate-700">
                    {asset.received_date || "-"}
                </td>
                </tr>
            ))}
        </tbody>
        </table>
      </div>

      {/* ถ้าค้นหาแล้วไม่พบข้อมูล */}
      {filteredAssets.length === 0 && (
        <p className="p-6 text-center text-gray-500">
          ไม่พบข้อมูลทรัพย์สิน
        </p>
      )}
    </div>
  );
}