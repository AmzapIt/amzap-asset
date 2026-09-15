"use client";

import Link from "next/link";
import AssetLookups from "@/app/components/AssetLookups";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ==================================================
// สถานะ Asset
// ต้องตรงกับ CHECK constraint ใน PostgreSQL
// ==================================================
const statuses = [
  "In Stock",
  "In Use",
  "Repair",
  "Spare",
  "Retired",
  "Disposed",
  "Lost",
];

// Class กลางสำหรับ Input
const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500";

// ==================================================
// หน้า Edit Asset
// ==================================================
export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();

  // ID จาก URL
  // เช่น /assets/2/edit
  // id = "2"
  const id = params.id;

  // ==================================================
  // State ของ Form
  //
  // ใช้ชื่อแบบเดียวกับ API PATCH ที่เราทำไว้
  // ==================================================
  const [form, setForm] = useState({
    department: "", location: "", vendor: "",
    assetName: "",
    brand: "",
    model: "",
    serialNumber: "",
    computerName: "",
    description: "",
    status: "",
    receivedDate: "",

    // เก็บ User ID ของ Asset Owner
    assetOwner: "",

    purchaseDate: "",
    purchasePrice: "",
    poNumber: "",
    invoiceNumber: "",
    warrantyStart: "",
    warrantyEnd: "",
    warrantyType: "",
    costCenter: "",
    notes: "",
  });

  // ==================================================
  // ข้อมูลที่ดูได้ แต่ห้ามแก้
  //
  // เพราะ Database มี protect_asset_identity()
  // ป้องกัน:
  // - asset_code
  // - asset_type_id
  // - code_year
  // ==================================================
  const [assetCode, setAssetCode] = useState("");
  const [assetType, setAssetType] = useState("");

  // รายชื่อพนักงาน Active สำหรับ Asset Owner
  const [users, setUsers] = useState([]);

  // Owner เดิมของ Asset
  // ใช้กรณี Owner ปัจจุบันถูกเปลี่ยนเป็น Inactive แล้ว
  const [currentOwner, setCurrentOwner] = useState(null);

  // สถานะหน้า
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // อนุญาตให้บันทึกเมื่อโหลด Asset และรายชื่อ Owner ครบเท่านั้น
  // ป้องกันส่งฟอร์มว่างหรือข้อมูลที่โหลดมาไม่ครบไปทับข้อมูลเดิม
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  // ==================================================
  // Helper แปลง DATE จาก PostgreSQL
  //
  // Input type="date" ต้องการ:
  // yyyy-mm-dd
  // ==================================================
  function toDateInput(value) {
    if (!value) return "";

    return String(value).slice(0, 10);
  }

  // ==================================================
  // โหลด Asset + รายชื่อ User
  // ==================================================
  useEffect(() => {
    // ยกเลิกคำขอเก่าเมื่อเปลี่ยน Asset หรือออกจากหน้า
    // เพื่อไม่ให้ผลลัพธ์เก่ามาทับฟอร์มของ Asset ใหม่
    const controller = new AbortController();
    async function loadData() {
      try {
        setLoading(true);
        setReady(false);
        setMessage("");

        // ----------------------------------------------
        // โหลด Asset ปัจจุบัน
        // ----------------------------------------------
        const assetResponse = await fetch(`/api/assets/${id}`, { signal: controller.signal });

        const assetData = await assetResponse.json();

        if (!assetResponse.ok || !assetData.success) {
          throw new Error(assetData.error || "ไม่สามารถโหลดข้อมูล Asset ได้");
        }

        const asset = assetData.asset;

        // ==================================================
        // เอาข้อมูล Asset จาก Database ใส่ใน Form
        // ==================================================
        setForm({
          department: asset.owning_department_id == null ? "" : String(asset.owning_department_id),
          location: asset.location_id == null ? "" : String(asset.location_id),
          vendor: asset.vendor_id == null ? "" : String(asset.vendor_id),
          assetName: asset.asset_name || "",
          brand: asset.brand || "",
          model: asset.model || "",
          serialNumber: asset.serial_number || "",
          computerName: asset.computer_name || "",
          description: asset.description || "",
          status: asset.status || "",

          // เก็บ Asset Owner เดิม
          // Database เป็นตัวเลข แต่ select ใช้ String
          assetOwner:
            asset.asset_owner_id != null ? String(asset.asset_owner_id) : "",

          receivedDate: toDateInput(asset.received_date),
          purchaseDate: toDateInput(asset.purchase_date),

          purchasePrice:
            asset.purchase_price != null ? String(asset.purchase_price) : "",

          poNumber: asset.po_number || "",
          invoiceNumber: asset.invoice_number || "",
          warrantyStart: toDateInput(asset.warranty_start),
          warrantyEnd: toDateInput(asset.warranty_end),
          warrantyType: asset.warranty_type || "",
          costCenter: asset.cost_center || "",
          notes: asset.notes || "",
        });

        // ==================================================
        // โหลดรายชื่อพนักงาน Active
        // ==================================================

        // ประกาศ response และอ่าน JSON ก่อนตรวจผล เพื่อไม่ให้เกิด ReferenceError
        // โหลดเพียงชุดเดียว แล้วใช้ activeUsers ทั้งแสดงรายชื่อและตรวจ Owner เดิม
        const usersResponse = await fetch("/api/users/active", { signal: controller.signal });
        const usersData = await usersResponse.json();

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || "ไม่สามารถโหลดรายชื่อพนักงานได้");
        }

        // รายชื่อพนักงาน Active
        if (!Array.isArray(usersData.users)) {
          throw new Error("รูปแบบรายชื่อพนักงานไม่ถูกต้อง");
        }
        if (controller.signal.aborted) return;
        const activeUsers = usersData.users;

        // เก็บรายชื่อไว้ใช้ใน Dropdown
        setUsers(activeUsers);

        // ==================================================
        // ตรวจว่า Owner เดิมยัง Active อยู่หรือไม่
        // ==================================================
        if (asset.asset_owner_id != null) {
          const ownerStillActive = activeUsers.some(
            (user) => String(user.id) === String(asset.asset_owner_id),
          );

          // ถ้า Owner เดิมไม่อยู่ในรายชื่อ Active
          // ให้เก็บไว้แสดงเป็น Inactive
          if (!ownerStillActive) {
            setCurrentOwner({
              id: String(asset.asset_owner_id),
              full_name:
                asset.asset_owner_name || `Owner ID ${asset.asset_owner_id}`,
              status: asset.asset_owner_status,
            });
          } else {
            setCurrentOwner(null);
          }
        } else {
          // Asset นี้ยังไม่มี Owner
          setCurrentOwner(null);
        }

        // ----------------------------------------------
        // เก็บข้อมูล Identity แยกไว้
        // เพราะไม่อนุญาตให้แก้
        // ----------------------------------------------
        setAssetCode(asset.asset_code || "");
        setAssetType(asset.asset_type || "");
        setReady(true);

      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Load Edit Asset error:", error);

        setMessage(error.message || "ไม่สามารถโหลดข้อมูลได้");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    if (id) {
      loadData();
    }
    return () => controller.abort();
  }, [id]);

  // ==================================================
  // เปลี่ยนค่าของ Form
  // ==================================================
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ==================================================
  // Save การแก้ไข
  // ==================================================
  async function handleSubmit(event) {
    event.preventDefault();

    // ป้องกันกด Save ซ้ำ
    if (saving || !ready) return;

    try {
      setSaving(true);
      setMessage("");

      // ----------------------------------------------
      // ส่งเฉพาะ Field ที่อนุญาตให้แก้
      //
      // ไม่มี assetCode
      // ไม่มี assetType
      // จึงไม่ชน protect_asset_identity()
      // ----------------------------------------------
      const response = await fetch(`/api/assets/${id}`, {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถแก้ไข Asset ได้");
      }

      // แจ้งผลสำเร็จ
      window.alert("แก้ไข Asset สำเร็จ");

      // ----------------------------------------------
      // Save เสร็จแล้วกลับหน้า Asset Detail
      // ----------------------------------------------
      router.push(`/assets/${id}`);

      // บังคับให้ Server Component โหลดข้อมูลล่าสุด
      router.refresh();
    } catch (error) {
      console.error("Update Asset error:", error);

      setMessage(error.message || "ไม่สามารถแก้ไข Asset ได้");
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // Loading
  // ==================================================
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-5xl">กำลังโหลดข้อมูล Asset...</div>
      </main>
    );
  }

  // ==================================================
  // UI
  // ==================================================
  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* กลับหน้า Detail */}
        <Link
          href={`/assets/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← กลับหน้า Asset Detail
        </Link>

        {/* Header */}
        <div className="mt-4">
          <p className="text-sm text-gray-500">Edit Asset</p>

          <h1 className="mt-1 text-3xl font-bold text-gray-800">{assetCode}</h1>

          <p className="mt-2 text-gray-500">แก้ไขข้อมูลทรัพย์สิน</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <AssetLookups form={form} onChange={handleChange} />
          {/* ==================================================
              GENERAL INFORMATION
          ================================================== */}
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">General Information</h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Asset Code */}
              <div>
                <label className="mb-2 block font-medium">Asset Code</label>

                <input
                  value={assetCode}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />

                <p className="mt-1 text-xs text-gray-500">
                  Asset Code ไม่สามารถแก้ไขได้
                </p>
              </div>

              {/* Asset Type */}
              <div>
                <label className="mb-2 block font-medium">Asset Type</label>

                <input
                  value={assetType}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />

                <p className="mt-1 text-xs text-gray-500">
                  Asset Type ไม่สามารถแก้ไขได้
                </p>
              </div>

              {/* Asset Name */}
              <div>
                <label className="mb-2 block font-medium">Asset Name</label>

                <input
                  name="assetName"
                  value={form.assetName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              {/* Status */}
              <div>
                <label className="mb-2 block font-medium">Status</label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <label className="mb-2 block font-medium">Brand</label>

                <input
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Model */}
              <div>
                <label className="mb-2 block font-medium">Model</label>

                <input
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Serial Number */}
              <div>
                <label className="mb-2 block font-medium">Serial Number</label>

                <input
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Computer Name */}
              <div>
                <label className="mb-2 block font-medium">Computer Name</label>

                <input
                  name="computerName"
                  value={form.computerName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Received Date */}
              <div>
                <label className="mb-2 block font-medium">Received Date</label>

                <input
                  type="date"
                  name="receivedDate"
                  value={form.receivedDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Asset Owner */}
              <div>
                <label htmlFor="assetOwner" className="mb-2 block font-medium">Asset Owner</label>

                <select
                  id="assetOwner"
                  name="assetOwner"
                  value={form.assetOwner}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">-- ไม่มี Asset Owner --</option>

                  {/* Owner เดิมที่ไม่อยู่ใน Active Users: ใช้ชื่อจาก GET Asset และคง ID เดิมไว้เมื่อบันทึก */}
                  {currentOwner && (
                    <option value={String(currentOwner.id)}>
                      {currentOwner.full_name} (Inactive)
                    </option>
                  )}

                  {/* select ใช้ String เช่นเดียวกับ form.assetOwner เพื่อให้เลือก Owner เดิมได้ตรงกัน */}
                  {users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">Description</label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* ==================================================
              PURCHASE & WARRANTY
          ================================================== */}
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Purchase & Warranty</h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">Purchase Date</label>

                <input
                  type="date"
                  name="purchaseDate"
                  value={form.purchaseDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Purchase Price</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="purchasePrice"
                  value={form.purchasePrice}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">PO Number</label>

                <input
                  name="poNumber"
                  value={form.poNumber}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Invoice Number</label>

                <input
                  name="invoiceNumber"
                  value={form.invoiceNumber}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Warranty Start</label>

                <input
                  type="date"
                  name="warrantyStart"
                  value={form.warrantyStart}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Warranty End</label>

                <input
                  type="date"
                  name="warrantyEnd"
                  value={form.warrantyEnd}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Warranty Type</label>

                <input
                  name="warrantyType"
                  value={form.warrantyType}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Cost Center</label>

                <input
                  name="costCenter"
                  value={form.costCenter}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="mb-2 block font-medium">Notes</label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* ==================================================
              SAVE / CANCEL
          ================================================== */}
          <div className="rounded-xl bg-white p-6 shadow">
            {/* Error */}
            {message && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 p-3 text-red-700"
              >
                {message}
              </p>
            )}

            <div className="flex items-center justify-between gap-4">
              {/* Cancel */}
              <Link
                href={`/assets/${id}`}
                className="rounded-lg border border-gray-300 px-5 py-3"
              >
                Cancel
              </Link>

              {/* Save */}
              <button
                type="submit"
                disabled={saving || !ready}
                className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
