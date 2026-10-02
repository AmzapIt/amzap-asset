"use client";

import Link from "next/link";
import AssetLookups from "@/app/components/AssetLookups";
import AssetAdditionalFields from "@/app/assets/AssetAdditionalFields";
import AssetPhotoField from "@/app/assets/AssetPhotoField";
import {
  additionalFromApi,
  emptyAdditionalForm,
} from "@/lib/asset-additional";
import { formatUserDisplayName } from "@/lib/user-display";
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
  "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

const vendorLookupFields = ["vendor"];

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
    ...emptyAdditionalForm,
  });

  // Documents/Maintenance เป็นประวัติหลายรายการ จึงแสดงของเดิมแบบอ่านอย่างเดียว
  // และใช้ช่องว่างในฟอร์มสำหรับเพิ่มรายการใหม่โดยไม่เขียนทับประวัติ
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [existingMaintenance, setExistingMaintenance] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

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
  const [originalStatus, setOriginalStatus] = useState("");
  const [assetType, setAssetType] = useState("");
  const [registrationSite, setRegistrationSite] = useState("");
  const [previousAssetCode, setPreviousAssetCode] = useState("");

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
        setOriginalStatus(asset.status || "");

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
          ...additionalFromApi(assetData.additional),
        });

        setExistingDocuments(assetData.additional?.documents || []);
        setExistingMaintenance(assetData.additional?.maintenance || []);

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
              nickname: asset.asset_owner_nickname || null,
              is_active: asset.asset_owner_is_active,
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
        setRegistrationSite(
          asset.registration_site_code && asset.registration_site_name
            ? `${asset.registration_site_code} — ${asset.registration_site_name}`
            : "ยังไม่ได้กำหนด",
        );
        setPreviousAssetCode(asset.history_assets || "");
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
    if (saving || photoProcessing || !ready) return;

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

      if (photo) {
        const photoForm = new FormData();
        photoForm.append("photo", photo);
        const photoResponse = await fetch(`/api/assets/${id}/photos`, {
          method: "POST",
          body: photoForm,
        });
        const photoData = await photoResponse.json();

        if (!photoResponse.ok || !photoData.success) {
          // ข้อมูล Asset ถูกแก้ไขสำเร็จแล้ว แต่คงหน้า Edit ไว้เพื่อให้เลือก
          // รูปใหม่และกด Save ซ้ำได้ โดยไม่ทำให้ข้อมูล Asset สูญหาย
          setMessage(
            `แก้ไข Asset สำเร็จ แต่ Upload รูปไม่สำเร็จ: ${
              photoData.error || "กรุณาลองใหม่"
            }`,
          );
          return;
        }
      }

      // แจ้งผลสำเร็จ
      window.alert(
        photo
          ? "แก้ไข Asset และ Upload รูปไป Google Drive สำเร็จ"
          : "แก้ไข Asset สำเร็จ",
      );

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
      <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[1200px]">กำลังโหลดข้อมูล Asset...</div>
      </main>
    );
  }

  // ==================================================
  // UI
  // ==================================================
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
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

          <h1 className="mt-1 break-words text-2xl font-bold text-gray-800 sm:text-3xl">{assetCode}</h1>

          <p className="mt-2 text-gray-500">แก้ไขข้อมูลทรัพย์สิน</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">

          {/* ==================================================
              GENERAL INFORMATION
          ================================================== */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
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

              <div>
                <label className="mb-2 block font-medium">สถานที่ขึ้นทะเบียน</label>
                <input
                  value={registrationSite}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  เป็นส่วนหนึ่งของ Asset Code และไม่เปลี่ยนตาม Location ปัจจุบัน
                </p>
              </div>

              {previousAssetCode && (
                <div>
                  <label className="mb-2 block font-medium">รหัสเดิม</label>
                  <input
                    value={previousAssetCode}
                    readOnly
                    className={`${inputClass} bg-amber-50`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    เก็บไว้สำหรับค้นหาและเทียบกับป้ายเดิม
                  </p>
                </div>
              )}

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
                  disabled={form.status === "In Use"}
                  className={inputClass}
                >
                  {statuses.filter((status) =>
                    (status !== "In Use" || form.status === "In Use") &&
                    !(originalStatus === "Repair" && status === "In Stock")
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  สถานะ In Use เปลี่ยนผ่านการมอบหมาย/รับคืนในหน้า Asset Detail เท่านั้น
                  {form.status === "In Use" ? " รับคืนเข้าคลัง IT ก่อนแก้สถานะอื่น" : ""}
                  {originalStatus === "Repair" && <>
                    {" "}เมื่อตรวจซ่อมเสร็จให้ใช้ <Link href={`/assets/${id}#asset-action`} className="text-blue-700 underline">ซ่อมเสร็จ / พร้อมเบิก</Link> บนหน้า Asset Detail
                  </>}
                </p>
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
                <label htmlFor="assetOwner" className="mb-2 block font-medium">Asset Owner / ผู้รับผิดชอบ</label>

                <select
                  id="assetOwner"
                  name="assetOwner"
                  value={form.assetOwner}
                  disabled
                  className={`${inputClass} cursor-not-allowed opacity-70`}
                >
                  <option value="">-- ไม่มี Asset Owner --</option>

                  {/* Owner เดิมที่ไม่อยู่ใน Active Users: ใช้ชื่อจาก GET Asset และคง ID เดิมไว้เมื่อบันทึก */}
                  {currentOwner && (
                    <option value={String(currentOwner.id)}>
                      {formatUserDisplayName(currentOwner)} (Inactive)
                    </option>
                  )}

                  {/* select ใช้ String เช่นเดียวกับ form.assetOwner เพื่อให้เลือก Owner เดิมได้ตรงกัน */}
                  {users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {formatUserDisplayName(user)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  การเปลี่ยน Asset Owner ต้องใช้ Asset Movement ในหน้า Detail เพื่อเก็บประวัติ
                </p>
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

          {/* จัดกลุ่ม Master Data เหมือนหน้า Add โดยไม่เปลี่ยนข้อมูลหรือวิธีบันทึก */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Vendor</h2>
              <Link
                href={`/assets/${id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                จัดการ Owner / Department / Location ที่หน้า Asset Detail
              </Link>
            </div>
            <AssetLookups
              form={form}
              onChange={handleChange}
              fields={vendorLookupFields}
            />
          </section>

          {/* ==================================================
              PURCHASE & WARRANTY
          ================================================== */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
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

          <AssetAdditionalFields
            form={form}
            onChange={handleChange}
            existingDocuments={existingDocuments}
            existingMaintenance={existingMaintenance}
          />

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Asset Photo</h2>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              รูปล่าสุดจะเป็นรูปหลัก ส่วนรูปเดิมยังคงอยู่ในประวัติเอกสาร
            </p>
            <AssetPhotoField
              disabled={saving || !ready}
              photo={photo}
              onChange={setPhoto}
              onProcessingChange={setPhotoProcessing}
            />
          </section>

          {/* ==================================================
              SAVE / CANCEL
          ================================================== */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
            {/* Error */}
            {message && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 p-3 text-red-700"
              >
                {message}
              </p>
            )}

            <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
              {/* Cancel */}
              <Link
                href={`/assets/${id}`}
                className="rounded-lg border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              {/* Save */}
              <button
                type="submit"
                disabled={saving || photoProcessing || !ready}
                className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-blue-900 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : photoProcessing
                    ? "Preparing photo..."
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
