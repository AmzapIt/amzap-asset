"use client";

import Link from "next/link";
import AssetLookups from "@/app/components/AssetLookups";
import AssetAdditionalFields from "@/app/assets/AssetAdditionalFields";
import {
  additionalFieldNames,
  emptyAdditionalForm,
} from "@/lib/asset-additional";
import { buildAssetCodePreview } from "@/lib/asset-code";
import { formatUserDisplayName } from "@/lib/user-display";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ==================================================
// 1. MASTER DATA สำหรับแสดงใน Form
// ==================================================

// ชื่อประเภทต้องตรงกับตาราง asset_types ใน PostgreSQL
// Prefix ใช้แสดงตัวอย่างเท่านั้น รหัสจริงให้ Database สร้าง

// สถานะต้องตรงกับ CHECK constraint ของตาราง assets
const statuses = [
  "In Stock",
  "In Use",
  "Repair",
  "Spare",
  "Retired",
  "Disposed",
  "Lost",
];

// ==================================================
// 2. ค่าเริ่มต้นของ Form
// ==================================================

// ใช้ Object เดียวเก็บข้อมูลทุกช่อง
// ไม่ต้องสร้าง useState แยก name, type, status ฯลฯ
const initialForm = {
  // General Information
  registrationSiteId: "",
  type: "",
  assetCodeNumber: "",
  receivedDate: "",
  assetName: "",
  brand: "",
  model: "",
  serialNumber: "",
  computerName: "",
  description: "",
  status: "In Stock",
  notes: "",

  // Ownership & Location (Assignment is created from Asset Detail)
  assetOwner: "",
  department: "",
  location: "",

  // Purchase & Warranty
  purchaseDate: "",
  purchasePrice: "",
  vendor: "",
  poNumber: "",
  invoiceNumber: "",
  warrantyStart: "",
  warrantyEnd: "",
  warrantyType: "",
  costCenter: "",

  // Technical Information
  hostname: "",
  ipAddress: "",
  macAddress: "",
  operatingSystem: "",
  cpu: "",
  ramGb: "",
  storageGb: "",
  biosFirmware: "",
  vlan: "",
  managementIp: "",
  rack: "",
  rackU: "",
  screenSize: "",
  resolution: "",

  // Security / Compliance
  encryptionEnabled: "",
  encryptionType: "",
  antivirusEdr: "",
  lastSecurityCheck: "",
  patchStatus: "",
  localAdminPolicy: "",
  dataClassification: "",
  lastAssetCheck: "",
  securityNotes: "",

  // เอกสารและ Maintenance ใช้ชื่อ field กลางร่วมกับหน้า Edit/API
  ...emptyAdditionalForm,
};

// ==================================================
// 3. กำหนดฟิลด์ของแต่ละหมวด
// ==================================================

// ข้อดีของการใช้ Config:
// เพิ่ม Field ใหม่ได้โดยไม่ต้องเขียน JSX Input ซ้ำทุกครั้ง
// name ต้องตรงกับ Property ใน initialForm
const generalFields = [
  { name: "receivedDate", label: "Received Date", type: "date" },
  { name: "assetName", label: "Asset Name", required: true },
  { name: "brand", label: "Brand" },
  { name: "model", label: "Model" },
  { name: "serialNumber", label: "Serial Number" },
  { name: "computerName", label: "Computer Name" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "status", label: "Status", options: statuses },
  { name: "notes", label: "Notes", type: "textarea" },
];

// 5 หมวดนี้จะถูกนำไปสร้างเป็นกล่องพับได้
const collapsibleGroups = [
  {
    title: "Ownership & Location",
    description: "ผู้รับผิดชอบหลักและสถานที่เริ่มต้น (มอบหมายผู้ครอบครองหลังสร้าง Asset)",
    fields: [
      { name: "assetOwner", label: "Asset Owner / ผู้รับผิดชอบ" },
      { name: "department", label: "Department" },
      { name: "location", label: "Location" },
    ],
  },
  {
    title: "Purchase & Warranty",
    description: "ข้อมูลจัดซื้อและการรับประกัน",
    fields: [
      { name: "purchaseDate", label: "Purchase Date", type: "date" },
      {
        name: "purchasePrice",
        label: "Purchase Price (THB)",
        type: "number",
        min: "0",
        step: "0.01",
      },
      { name: "vendor", label: "Vendor" },
      { name: "poNumber", label: "PO Number" },
      { name: "invoiceNumber", label: "Invoice Number" },
      { name: "warrantyStart", label: "Warranty Start", type: "date" },
      { name: "warrantyEnd", label: "Warranty End", type: "date" },
      { name: "warrantyType", label: "Warranty Type" },
      { name: "costCenter", label: "Cost Center" },
    ],
  },
  {
    title: "Technical Information",
    description: "ข้อมูลเทคนิคตามประเภทอุปกรณ์",
    fields: [
      { name: "hostname", label: "Hostname" },
      { name: "ipAddress", label: "IP Address" },
      { name: "macAddress", label: "MAC Address" },
      { name: "operatingSystem", label: "Operating System" },
      { name: "cpu", label: "CPU" },
      {
        name: "ramGb",
        label: "RAM (GB)",
        type: "number",
        min: "0",
        step: "0.01",
      },
      {
        name: "storageGb",
        label: "Storage (GB)",
        type: "number",
        min: "0",
        step: "0.01",
      },
      { name: "biosFirmware", label: "BIOS / Firmware" },
      { name: "vlan", label: "VLAN", type: "number", min: "1", max: "4094" },
      { name: "managementIp", label: "Management IP" },
      { name: "rack", label: "Rack" },
      { name: "rackU", label: "U Position", type: "number", min: "1" },

      // แสดงเฉพาะเมื่อเลือกประเภท Monitor
      { name: "screenSize", label: "Screen Size", types: ["Monitor"] },
      { name: "resolution", label: "Resolution", types: ["Monitor"] },
    ],
  },
  {
    title: "Security / Compliance",
    description: "ข้อมูลความปลอดภัยและการตรวจสอบ",
    fields: [
      {
        name: "encryptionEnabled",
        label: "Encryption",
        options: [
          { value: "", label: "ยังไม่ระบุ" },
          { value: "true", label: "Enabled" },
          { value: "false", label: "Disabled" },
        ],
      },
      { name: "encryptionType", label: "Encryption Type" },
      { name: "antivirusEdr", label: "Antivirus / EDR" },
      { name: "lastSecurityCheck", label: "Last Security Check", type: "date" },
      { name: "patchStatus", label: "Patch Status" },
      { name: "localAdminPolicy", label: "Local Admin Policy" },
      { name: "dataClassification", label: "Data Classification" },
      { name: "lastAssetCheck", label: "Last Asset Check", type: "date" },
      { name: "securityNotes", label: "Security Notes", type: "textarea" },
    ],
  },
];

// ==================================================
// 4. ฟังก์ชันช่วยแสดงวันที่
// ==================================================

// PostgreSQL เก็บ DATE เป็น yyyy-mm-dd
// แต่หน้าเว็บต้องการแสดง dd/mm/yyyy
function formatDate(date) {
  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

// ==================================================
// 5. Component สำหรับสร้าง Input
// ==================================================

// รับข้อมูล Field แล้วเลือกว่าจะสร้าง input, select หรือ textarea
function FormField({ field, form, onChange }) {
  // อ่านค่าจาก State เช่น form.brand หรือ form.purchaseDate
  if (["department", "location", "vendor"].includes(field.name)) return null;
  const value = form[field.name] ?? "";

  return (
    <div>
      <label htmlFor={field.name} className="mb-2 block font-medium">
        {field.label}
        {field.required && <span className="text-red-600"> *</span>}
      </label>

      {/* ถ้ามี options ให้สร้าง Dropdown */}
      {field.options ? (
        <select
          id={field.name}
          name={field.name}
          value={value}
          onChange={onChange}
          className={inputClass}
        >
          {field.options.map((option) => {
            // รองรับทั้ง ["Notebook", "Monitor"]
            // และ [{ value: "true", label: "Enabled" }]
            const optionValue =
              typeof option === "string" ? option : option.value;

            const optionLabel =
              typeof option === "string" ? option : option.label;

            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      ) : field.type === "textarea" ? (
        // ถ้าเป็นข้อความยาว ให้ใช้ textarea
        <textarea
          id={field.name}
          name={field.name}
          value={value}
          onChange={onChange}
          rows={3}
          className={inputClass}
        />
      ) : field.type === "date" ? (
        <div className="relative">
          <input
            id={field.name}
            name={field.name}
            type="date"
            value={value}
            onChange={onChange}
            required={field.required || false}
            min={
              field.name === "warrantyEnd"
                ? form.warrantyStart || undefined
                : field.min
            }
            max={field.max}
            className={`${inputClass.replace("text-gray-900", "text-transparent")} caret-transparent [&::-webkit-datetime-edit]:opacity-0`}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-3 right-12 flex items-center ${value ? "text-gray-900" : "text-gray-400"}`}
          >
            {formatDate(value) || "dd/mm/yyyy"}
          </span>
        </div>
      ) : (
        // Field ทั่วไปใช้ input
        <input
          id={field.name}
          name={field.name}
          type={field.type || "text"}
          value={value}
          onChange={onChange}
          required={field.required || false}
          min={
            field.name === "warrantyEnd"
              ? form.warrantyStart || undefined
              : field.min
          }
          max={field.max}
          step={field.step}
          className={inputClass}
        />
      )}
    </div>
  );
}

// ==================================================
// 6. Component สำหรับหมวดที่พับได้
// ==================================================

// <details> = กล่องที่เปิด/ปิดได้
// <summary> = หัวข้อที่ผู้ใช้กด
// Browser จะแสดงสามเหลี่ยมให้โดยอัตโนมัติ
// ไม่ต้องใช้ useState เพื่อควบคุมการเปิด/ปิด
function CollapsibleSection({ title, description, children }) {
  return (
    <details className="rounded-lg bg-white shadow">
      <summary className="cursor-pointer px-6 py-5 font-semibold text-gray-800">
        {title}
      </summary>

      {/* ส่วนนี้จะซ่อนอยู่จนกว่าผู้ใช้จะกดเปิด */}
      <div className="border-t px-6 py-5">
        <p className="mb-5 text-sm text-gray-500">{description}</p>

        {children}
      </div>
    </details>
  );
}

// ==================================================
// 7. ฟิลด์ที่ API ปัจจุบันรองรับการบันทึก
// ==================================================

// API ที่เราทำไว้รองรับข้อมูลหลักและ Purchase & Warranty
// ส่วน Assignment, Technical, Security, Vendor และไฟล์
// ยังไม่ได้เชื่อมครบ จึงต้องป้องกันการบันทึกข้อมูลไม่ครบ
const supportedFields = [
  "registrationSiteId",
  "assetCodeNumber",
  "department",
  "location",
  "vendor",
  "type",
  "receivedDate",
  "assetOwner",
  "assetName",
  "brand",
  "model",
  "serialNumber",
  "computerName",
  "description",
  "status",
  "purchaseDate",
  "purchasePrice",
  "poNumber",
  "invoiceNumber",
  "warrantyStart",
  "warrantyEnd",
  "warrantyType",
  "costCenter",
  "notes",
  ...additionalFieldNames,
];

// ==================================================
// 8. หน้า Add Asset
// ==================================================
export default function AddAssetPage() {
  // ==================================================
  // Asset Types จาก Master Data
  // ==================================================
  const [assetTypes, setAssetTypes] = useState([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const [assetTypesError, setAssetTypesError] = useState("");
  const [registrationSites, setRegistrationSites] = useState([]);
  const [loadingRegistrationSites, setLoadingRegistrationSites] = useState(true);
  const [registrationSitesError, setRegistrationSitesError] = useState("");
  const [latestAssetCode, setLatestAssetCode] = useState(null);
  const [loadingLatestAssetCode, setLoadingLatestAssetCode] = useState(false);
  const [latestAssetCodeError, setLatestAssetCodeError] = useState("");
  const router = useRouter();

  // State หลักของ Form
  // ==================================================
  const [form, setForm] = useState(initialForm);

  // ==================================================
  // รายชื่อพนักงานสำหรับ Asset Owner
  // ==================================================

  // เก็บรายชื่อพนักงานที่ Active
  // ข้อมูลมาจาก GET /api/users/active
  const [activeUsers, setActiveUsers] = useState([]);

  // ใช้บอกว่า Dropdown กำลังโหลดรายชื่ออยู่
  const [loadingUsers, setLoadingUsers] = useState(true);

  // เก็บ Error ถ้าโหลดรายชื่อพนักงานไม่สำเร็จ
  const [usersError, setUsersError] = useState("");

  // เก็บไฟล์ที่เลือกไว้ชั่วคราว ยังไม่ได้ Upload
  const [photo, setPhoto] = useState(null);

  // ใช้ควบคุมปุ่ม Save และข้อความ Error
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ==================================================
  // โหลดรายชื่อพนักงาน Active
  //
  // ทำงานตอนเปิดหน้า Add Asset ครั้งแรก
  //
  // API จะดึง:
  // SELECT id, full_name, nickname, is_active
  // FROM public."user"
  // WHERE is_active = true
  // ==================================================
  // ==================================================
  // โหลด Asset Types ที่ Active จาก Master Data
  //
  // ข้อมูลมาจาก:
  // GET /api/master/asset_types
  //
  // หน้า Add Asset จะแสดงเฉพาะ:
  // is_active = true
  // ==================================================
  useEffect(() => {
    const controller = new AbortController();

    async function loadRegistrationSites() {
      try {
        setLoadingRegistrationSites(true);
        setRegistrationSitesError("");

        const response = await fetch("/api/asset-registration-sites", {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "ไม่สามารถโหลดสถานที่ขึ้นทะเบียนได้");
        }

        setRegistrationSites(data.sites || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Load registration sites error:", error);
          setRegistrationSitesError(
            error.message || "ไม่สามารถโหลดสถานที่ขึ้นทะเบียนได้",
          );
        }
      } finally {
        setLoadingRegistrationSites(false);
      }
    }

    loadRegistrationSites();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssetTypes() {
      try {
        setLoadingAssetTypes(true);
        setAssetTypesError("");

        const response = await fetch("/api/master/asset_types", {
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "ไม่สามารถโหลด Asset Types ได้");
        }

        // หน้า Add Asset ใช้เฉพาะ Asset Type ที่ Active
        const activeTypes = (data.rows || []).filter((item) => item.is_active);

        setAssetTypes(activeTypes);

      } catch (error) {
        // AbortError เกิดจากการออกจากหน้าก่อน fetch เสร็จ
        // ไม่จำเป็นต้องแสดง Error
        if (error.name !== "AbortError") {
          console.error("Load Asset Types error:", error);

          setAssetTypesError(error.message || "ไม่สามารถโหลด Asset Types ได้");
        }
      } finally {
        setLoadingAssetTypes(false);
      }
    }

    loadAssetTypes();

    return () => controller.abort();
  }, []);

  // ==================================================
  // โหลดรายชื่อพนักงาน Active
  //
  // ข้อมูลมาจาก:
  // GET /api/users/active
  //
  // ใช้สำหรับ Asset Owner
  // ==================================================
  useEffect(() => {
    const controller = new AbortController();

    async function loadActiveUsers() {
      try {
        setLoadingUsers(true);
        setUsersError("");

        const response = await fetch("/api/users/active", {
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "โหลดรายชื่อพนักงานไม่สำเร็จ");
        }

        // users ที่ API ส่งกลับมาเป็น Active Users
        setActiveUsers(data.users || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Load Asset Owner users error:", error);

          setUsersError(error.message || "โหลดรายชื่อพนักงานไม่สำเร็จ");
        }
      } finally {
        setLoadingUsers(false);
      }
    }

    loadActiveUsers();

    return () => controller.abort();
  }, []);

  // หา Prefix ของประเภทที่เลือก
  // เช่น Notebook → NB, Monitor → MON
  const selectedType = assetTypes.find((item) => item.name === form.type);
  const selectedRegistrationSite = registrationSites.find(
    (item) => String(item.id) === String(form.registrationSiteId),
  );
  const assetCodePreview = buildAssetCodePreview(
    selectedRegistrationSite?.site_code,
    selectedType?.prefix,
    form.assetCodeNumber,
  );
  const assetCodePrefix =
    selectedRegistrationSite?.site_code && selectedType?.prefix
      ? `${selectedRegistrationSite.site_code}-${selectedType.prefix}-`
      : "---";
  const canLoadLatestAssetCode = Boolean(
    form.registrationSiteId && selectedType?.id,
  );

  // รหัสล่าสุดเป็นข้อมูลช่วยตัดสินใจเท่านั้น ไม่ได้จองเลขไว้ให้ Request นี้
  // เมื่อเปลี่ยน Site หรือ Type จะยกเลิกคำขอเดิมเพื่อไม่ให้ผลเก่ามาแสดงผิดชุด
  useEffect(() => {
    const registrationSiteId = form.registrationSiteId;
    const assetTypeId = selectedType?.id == null ? "" : String(selectedType.id);

    if (!registrationSiteId || !assetTypeId) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadLatestAssetCode() {
      try {
        setLoadingLatestAssetCode(true);
        setLatestAssetCodeError("");

        const search = new URLSearchParams({
          registrationSiteId,
          assetTypeId,
        });
        const response = await fetch(`/api/assets/latest-code?${search}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "ไม่สามารถตรวจรหัสล่าสุดได้");
        }

        setLatestAssetCode(data.latestCode || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Load latest Asset Code error:", error);
          setLatestAssetCode(null);
          setLatestAssetCodeError(error.message || "ไม่สามารถตรวจรหัสล่าสุดได้");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingLatestAssetCode(false);
      }
    }

    loadLatestAssetCode();
    return () => controller.abort();
  }, [form.registrationSiteId, selectedType?.id]);

  // ==================================================
  // 9. เมื่อผู้ใช้แก้ข้อมูลใน Form
  // ==================================================
  function handleChange(event) {
    const { name, value } = event.target;

    // ...previous = เก็บค่า Field อื่นไว้เหมือนเดิม
    // [name]: value = เปลี่ยนเฉพาะ Field ที่ผู้ใช้แก้
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ==================================================
  // 10. กด Save → API → PostgreSQL
  // ==================================================
  async function handleSubmit(event) {
    event.preventDefault();

    // ป้องกันการกด Save ซ้ำ
    if (saving) return;

    setMessage("");

    if (!form.registrationSiteId) {
      setMessage("กรุณาเลือกสถานที่ขึ้นทะเบียนก่อนบันทึก");
      return;
    }

    if (!/^\d{3}$/.test(form.assetCodeNumber)) {
      setMessage("กรุณากรอกเลข Asset Code ให้ครบ 3 หลัก เช่น 001");
      return;
    }

    // เตือนก่อนบันทึกถ้ามีข้อมูลที่ API ยังไม่รองรับ
    // Photo ยังรอเชื่อม Storage ส่วนข้อมูล Technical/Security/Document URL/
    // Maintenance ถูกส่งให้ API และบันทึกจริงแล้ว
    const hasUnconnectedData = photo !== null;

    if (
      hasUnconnectedData &&
      !window.confirm(
        "มีข้อมูลในหมวดที่ยังไม่ได้เชื่อม API หรือไฟล์แนบ ข้อมูลส่วนนี้จะยังไม่ถูกบันทึก ต้องการบันทึกเฉพาะข้อมูลที่รองรับต่อหรือไม่?",
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      // ==================================================
      // สร้าง Payload จากข้อมูลใน Form
      // ==================================================
      const payload = Object.fromEntries(
        supportedFields.map((name) => [name, form[name]]),
      );

      // ส่งข้อมูลไป Backend
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // อ่านผลลัพธ์จาก API
      const data = await response.json();

      // ถ้า API ตอบ Error ให้แสดงข้อความ
      if (!response.ok || !data.success) {
        throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      }

      // Asset Code ต้องมาจาก PostgreSQL จริง
      const assetCode = data.asset?.asset_code;

      if (!assetCode) {
        throw new Error("API ไม่ส่ง Asset Code กลับมา");
      }

      // แสดง Alert หลังบันทึกสำเร็จ
      window.alert(
        `บันทึกข้อมูลสำเร็จ\nAsset Code: ${assetCode}${
          hasUnconnectedData
            ? "\n\nหมายเหตุ: ข้อมูลในหมวดที่ยังไม่เชื่อม API และไฟล์แนบยังไม่ได้บันทึก"
            : ""
        }`,
      );

      // กลับหน้า Asset List
      router.push("/assets");
    } catch (error) {
      setMessage(error.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // 11. ส่วนแสดงผลหน้าเว็บ
  // ==================================================
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <h1 className="text-3xl font-bold text-gray-800">Add Asset</h1>

        <p className="mt-2 text-gray-500">ลงทะเบียนทรัพย์สิน IT</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* ==========================================
              GENERAL INFORMATION
              หมวดนี้แสดงตลอด ไม่ต้องกดเปิด
          ========================================== */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800">
              General Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              ข้อมูลพื้นฐานของทรัพย์สิน
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Registration Site ต้องเลือกก่อน เพราะเป็น F1/F2 ในรหัสถาวร */}
              <div>
                <label htmlFor="registrationSiteId" className="mb-2 block font-medium">
                  สถานที่ขึ้นทะเบียน <span className="text-red-600">*</span>
                </label>

                <select
                  id="registrationSiteId"
                  name="registrationSiteId"
                  value={form.registrationSiteId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loadingRegistrationSites}
                  required
                >
                  <option value="">
                    {loadingRegistrationSites
                      ? "กำลังโหลดสถานที่ขึ้นทะเบียน..."
                      : "-- เลือกสถานที่ขึ้นทะเบียน --"}
                  </option>
                  {registrationSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_code} — {site.name}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-gray-500">
                  ใช้สร้างรหัสถาวรและจะไม่เปลี่ยนเมื่อย้าย Location ภายหลัง
                </p>
                {registrationSitesError && (
                  <p className="mt-1 text-sm text-red-600">
                    {registrationSitesError}
                  </p>
                )}
              </div>

              {/* Asset Type */}
              <div>
                <label className="mb-2 block font-medium">Asset Type</label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loadingAssetTypes || !form.registrationSiteId}
                  required
                >
                  <option value="">
                    {loadingAssetTypes
                      ? "กำลังโหลด Asset Types..."
                      : !form.registrationSiteId
                        ? "-- เลือกสถานที่ขึ้นทะเบียนก่อน --"
                        : "-- เลือก Asset Type --"}
                  </option>

                  {[...assetTypes]
                    .sort((a, b) => Number(a.id) - Number(b.id))
                    .map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                </select>

                {/* แสดง Error กรณีโหลด Asset Types ไม่สำเร็จ */}
                {assetTypesError && (
                  <p className="mt-1 text-sm text-red-600">{assetTypesError}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="assetCodeNumber" className="mb-2 block font-medium">
                  Asset Code <span className="text-red-600">*</span>
                </label>
                <div className="flex max-w-md">
                  <div className="flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-3 font-mono font-semibold text-slate-700">
                    {assetCodePrefix}
                  </div>
                  <input
                    id="assetCodeNumber"
                    name="assetCodeNumber"
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={form.assetCodeNumber}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "");
                      setForm((previous) => ({
                        ...previous,
                        assetCodeNumber: value,
                      }));
                    }}
                    placeholder="001"
                    className="w-24 rounded-r-lg border border-slate-300 bg-white p-3 text-center font-mono font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <p className="text-gray-500">
                    Asset Code: {" "}
                    <span className="font-mono font-semibold text-gray-700">
                      {assetCodePreview}
                    </span>
                  </p>
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                    ล่าสุดในระบบ: {" "}
                    <span className="font-mono font-semibold">
                      {!canLoadLatestAssetCode
                        ? "เลือก Site และ Type"
                        : loadingLatestAssetCode
                        ? "กำลังตรวจสอบ..."
                        : latestAssetCode || "ยังไม่มีรหัส"}
                    </span>
                  </p>
                </div>
                {canLoadLatestAssetCode && latestAssetCodeError && (
                  <p className="mt-1 text-sm text-red-600">
                    {latestAssetCodeError}
                  </p>
                )}
              </div>

              {/* สร้าง Field ของ General จาก Config */}
              {generalFields.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  form={form}
                  onChange={handleChange}
                />
              ))}
            </div>

            {/* Photo ยังไม่ Upload */}
            <div className="mt-5">
              <label className="mb-2 block font-medium">Photo</label>

              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPhoto(event.target.files?.[0] || null)}
                className={inputClass}
              />

              {photo && (
                <p className="mt-2 text-sm text-gray-500">
                  Selected: {photo.name}
                </p>
              )}
            </div>
          </section>

          {/* ==========================================
              COLLAPSIBLE GROUPS
              ทั้ง 4 หมวดนี้เริ่มต้นแบบซ่อนข้อมูล
              กดหัวข้อเพื่อเปิด/ปิดได้
          ========================================== */}
          {collapsibleGroups.map((group) => (
            <CollapsibleSection
              key={group.title}
              title={group.title}
              description={group.description}
            >
              {/* รวม dropdown Master Data ไว้ใน Assignment & Location โดยใช้ state และ API เดิม */}
              {group.title === "Ownership & Location" && (
                <div className="mb-5">
                  <AssetLookups form={form} onChange={handleChange} />
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {group.fields
                  // Field ที่มี types จะแสดงเฉพาะประเภทนั้น
                  .filter(
                    (field) => !field.types || field.types.includes(form.type),
                  )
                  .map((field) => {
                    // ==================================================
                    // Asset Owner ใช้ Dropdown รายชื่อพนักงาน
                    //
                    // ไม่ใช้ FormField ปกติ เพราะเราต้องการ
                    // รายชื่อแบบ Dynamic จาก Database
                    // ==================================================
                    if (field.name === "assetOwner") {
                      return (
                        <div key={field.name}>
                          <label
                            htmlFor="assetOwner"
                            className="mb-2 block font-medium"
                          >
                            Asset Owner / ผู้รับผิดชอบ
                          </label>

                          <select
                            id="assetOwner"
                            // ต้องตรงกับ initialForm.assetOwner
                            name="assetOwner"
                            // ค่าที่เลือกคือ User ID
                            value={form.assetOwner}
                            // ใช้ handleChange เดิม
                            // เมื่อเลือกแล้ว:
                            // form.assetOwner = user.id
                            onChange={handleChange}
                            // ระหว่างโหลดรายชื่อ
                            // ปิด Dropdown ชั่วคราว
                            disabled={loadingUsers}
                            className={inputClass}
                          >
                            {/* ================================
                          ค่าเริ่มต้นของ Dropdown
                      ================================= */}
                            <option value="">
                              {loadingUsers
                                ? "กำลังโหลดรายชื่อพนักงาน..."
                                : "-- เลือก Asset Owner --"}
                            </option>

                            {/* ================================
                          แสดงรายชื่อพนักงาน Active

                          สิ่งที่ผู้ใช้เห็น:
                          user.full_name และ nickname (ถ้ามี)

                          สิ่งที่ Form เก็บ:
                          user.id
                      ================================= */}
                            {/* แสดงชื่อและชื่อเล่นเพื่อช่วยแยกพนักงานตอนเลือก
    เช่น ผู้ใช้เห็น "วัจน์กร ถือนิล (เดย์)" แต่ form.assetOwner เก็บ "27"
    nickname เป็นข้อความสำหรับแสดงเท่านั้นและไม่ถูกบันทึกลง Asset
    ใช้ String ให้ตรงกับค่าที่ HTML select ส่งผ่าน onChange */}
                            {activeUsers.map((user) => (
                              <option key={user.id} value={String(user.id)}>
                                {formatUserDisplayName(user)}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500">
                            ผู้ครอบครองจริงให้จัดการผ่าน Assignment ในหน้า Asset Detail หลังสร้าง Asset
                          </p>

                          {/* ================================
                        แสดง Error ถ้าโหลดรายชื่อไม่ได้
                    ================================= */}
                          {usersError && (
                            <p className="mt-1 text-sm text-red-600">
                              {usersError}
                            </p>
                          )}
                        </div>
                      );
                    }

                    // ==================================================
                    // Field อื่นยังใช้ FormField เดิมทั้งหมด
                    // ==================================================
                    return (
                      <FormField
                        key={field.name}
                        field={field}
                        form={form}
                        onChange={handleChange}
                      />
                    );
                  })}
              </div>
            </CollapsibleSection>
          ))}

          {/* ==========================================
              DOCUMENTS & HISTORY
              หมวดที่ 5 ที่พับได้
          ========================================== */}
          <AssetAdditionalFields
            form={form}
            onChange={handleChange}
            sections={["documents", "maintenance"]}
          />

          {/* ==========================================
              SAVE / BACK
          ========================================== */}
          <div className="rounded-lg bg-white p-6 shadow">
            {message && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 p-3 text-red-700"
              >
                {message}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/assets"
                className="rounded-lg border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-blue-900 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Asset"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
