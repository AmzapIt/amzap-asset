"use client";

import Link from "next/link";
import AssetLookups from "@/app/components/AssetLookups";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ==================================================
// 1. MASTER DATA สำหรับแสดงใน Form
// ==================================================

// ตอนนี้ใช้รายการประเภทแบบกำหนดไว้ใน Code ก่อน
// ชื่อประเภทต้องตรงกับตาราง asset_types ใน PostgreSQL
// Prefix ใช้แสดงตัวอย่างเท่านั้น รหัสจริงให้ Database สร้าง
const assetTypes = [
  { name: "Notebook", prefix: "NB" },
  { name: "Desktop", prefix: "DES" },
  { name: "Monitor", prefix: "MON" },
  { name: "Printer", prefix: "PRN" },
  { name: "Switch", prefix: "SW" },
  { name: "Access Point", prefix: "AP" },
  { name: "Firewall", prefix: "FW" },
  { name: "Server", prefix: "SVR" },
  { name: "NAS", prefix: "NAS" },
  { name: "UPS", prefix: "UPS" },
];

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
  type: "Notebook",
  // Asset Code ตัวเต็ม
  // เช่น NB-AMZ26-001
  // ค่านี้จะถูกประกอบตอนกด Save
  assetCode: "",
  receivedDate: "",
  assetName: "",
  brand: "",
  model: "",
  serialNumber: "",
  computerName: "",
  description: "",
  status: "In Stock",
  notes: "",

  // Assignment & Location
  assetOwner: "",
  assignedTo: "",
  department: "",
  location: "",
  building: "",
  floor: "",
  room: "",
  assignedDate: "",

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
    title: "Assignment & Location",
    description: "ผู้รับผิดชอบ ผู้ใช้งาน และสถานที่",
    fields: [
      { name: "assetOwner", label: "Asset Owner" },
      { name: "assignedTo", label: "Assigned To" },
      { name: "department", label: "Department" },
      { name: "location", label: "Location" },
      { name: "building", label: "Building" },
      { name: "floor", label: "Floor" },
      { name: "room", label: "Room" },
      { name: "assignedDate", label: "Assigned Date", type: "date" },
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
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900";

// ==================================================
// 5. Component สำหรับสร้าง Input
// ==================================================

// รับข้อมูล Field แล้วเลือกว่าจะสร้าง input, select หรือ textarea
function FormField({ field, form, onChange }) {
  // อ่านค่าจาก State เช่น form.brand หรือ form.purchaseDate
  if (["department","location","vendor"].includes(field.name)) return null;
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
  "department", "location", "vendor",
  "type",
  "assetCode",
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
];

// ==================================================
// 8. หน้า Add Asset
// ==================================================
export default function AddAssetPage() {
  const router = useRouter();

  // State หลักของ Form
  // ==================================================
  const [form, setForm] = useState(initialForm);

  // ==================================================
  // เลขท้าย Asset Code จำนวน 3 หลัก
  //
  // ตัวอย่าง:
  // 001
  // 025
  // 999
  //
  // ระบบจะเอาไปต่อกับ Prefix เช่น:
  // NB-AMZ26- + 001
  //
  // ผลลัพธ์:
  // NB-AMZ26-001
  // ==================================================
  const [assetCodeNumber, setAssetCodeNumber] = useState("");

  // ==================================================
  // รายชื่อพนักงานสำหรับ Asset Owner
  // ==================================================

  // เก็บรายชื่อพนักงานที่ status = 1
  // ข้อมูลมาจาก GET /api/users/active
  const [activeUsers, setActiveUsers] = useState([]);

  // ใช้บอกว่า Dropdown กำลังโหลดรายชื่ออยู่
  const [loadingUsers, setLoadingUsers] = useState(true);

  // เก็บ Error ถ้าโหลดรายชื่อพนักงานไม่สำเร็จ
  const [usersError, setUsersError] = useState("");

  // เก็บไฟล์ที่เลือกไว้ชั่วคราว ยังไม่ได้ Upload
  const [photo, setPhoto] = useState(null);
  const [documents, setDocuments] = useState([]);

  // ใช้ควบคุมปุ่ม Save และข้อความ Error
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ==================================================
  // โหลดรายชื่อพนักงาน Active
  //
  // ทำงานตอนเปิดหน้า Add Asset ครั้งแรก
  //
  // API จะดึง:
  // SELECT id, full_name, status
  // FROM public."user"
  // WHERE status = 1
  // ==================================================
  useEffect(() => {
    async function loadActiveUsers() {
      try {
        // เริ่ม Loading
        setLoadingUsers(true);

        // ล้าง Error เก่า
        setUsersError("");

        // ==================================================
        // เรียก API รายชื่อพนักงาน
        // ==================================================
        const response = await fetch("/api/users/active");

        const data = await response.json();

        // ถ้า API Error เช่น 500
        if (!response.ok || !data.success) {
          throw new Error(data.error || "โหลดรายชื่อพนักงานไม่สำเร็จ");
        }

        // ==================================================
        // เก็บรายชื่อพนักงานลง State
        //
        // activeUsers จะมีหน้าตาประมาณ:
        //
        // [
        //   {
        //     id: 1,
        //     full_name: "สมชาย ใจดี",
        //     status: 1
        //   }
        // ]
        // ==================================================
        setActiveUsers(data.users || []);
      } catch (error) {
        console.error("Load Asset Owner users error:", error);

        // แสดง Error ใต้ Dropdown
        setUsersError(error.message || "โหลดรายชื่อพนักงานไม่สำเร็จ");
      } finally {
        // โหลดเสร็จแล้ว
        setLoadingUsers(false);
      }
    }

    // เรียกตอนเปิดหน้า
    loadActiveUsers();
  }, []);

  // หา Prefix ของประเภทที่เลือก
  // เช่น Notebook → NB, Monitor → MON

  const selectedType = assetTypes.find((item) => item.name === form.type);
  // ==================================================
  // ปีปัจจุบันแบบ 2 หลัก
  //
  // 2026 -> "26"
  // 2027 -> "27"
  // ==================================================
  const currentYear = String(new Date().getFullYear()).slice(-2);

  // ==================================================
  // สร้างส่วนหน้าของ Asset Code อัตโนมัติ
  //
  // Notebook:
  // NB-AMZ26-
  //
  // Monitor:
  // MON-AMZ26-
  //
  // Printer:
  // PRN-AMZ26-
  // ==================================================
  const assetCodePrefix = `${selectedType?.prefix || ""}-AMZ${currentYear}-`;

  // ==================================================
  // Asset Code ตัวเต็ม
  //
  // ตัวอย่าง:
  // assetCodePrefix = "NB-AMZ26-"
  // assetCodeNumber = "001"
  //
  // fullAssetCode = "NB-AMZ26-001"
  // ==================================================
  // Asset Code ตัวเต็มที่จะส่งไป Backend
  // เช่น NB-AMZ26-001
  const fullAssetCode = `${assetCodePrefix}${assetCodeNumber}`;

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

    // ==================================================
    // ตรวจเลขท้าย Asset Code
    //
    // ต้องกรอกให้ครบ 3 หลัก
    // และต้องเป็นตัวเลข 0-9 เท่านั้น
    //
    // ถูก:
    // 001
    // 025
    // 999
    //
    // ผิด:
    // 1
    // 01
    // ABC
    // 12A
    // ==================================================
    if (!/^\d{3}$/.test(assetCodeNumber)) {
      setMessage("กรุณากรอกเลข Asset Code ให้ครบ 3 หลัก เช่น 001");

      return;
    }

    // เตือนก่อนบันทึกถ้ามีข้อมูลที่ API ยังไม่รองรับ
    const hasUnconnectedData =
      Object.entries(form).some(
        ([name, value]) => !supportedFields.includes(name) && value !== "",
      ) ||
      photo !== null ||
      documents.length > 0;

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
      // ถ้าไม่ส่ง Asset Code ให้ Database/trigger ตรวจ counter ล่าสุดและสร้างรหัสถัดไป
      // ==================================================
      // สร้าง Payload จากข้อมูลใน Form
      // ==================================================
      const payload = Object.fromEntries(
        supportedFields.map((name) => [name, form[name]]),
      );

      // ==================================================
      // ประกอบ Asset Code ตัวเต็มก่อนส่งไป API
      //
      // ตัวอย่าง:
      // Prefix          = NB-AMZ26-
      // assetCodeNumber = 001
      //
      // ส่งไป API:
      // assetCode = NB-AMZ26-001
      // ==================================================
      payload.assetCode = fullAssetCode;

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
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-gray-800">Add Asset</h1>

        <p className="mt-2 text-gray-500">ลงทะเบียนทรัพย์สิน IT</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">

          {/* ==========================================
              GENERAL INFORMATION
              หมวดนี้แสดงตลอด ไม่ต้องกดเปิด
          ========================================== */}
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-800">
              General Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              ข้อมูลพื้นฐานของทรัพย์สิน
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Asset Type */}
              <div>
                <label className="mb-2 block font-medium">Asset Type</label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {assetTypes.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ==================================================
                  ASSET CODE

                  ระบบสร้างส่วนหน้าให้อัตโนมัติ:
                  NB-AMZ26-

                  ผู้ใช้กรอกเฉพาะเลขท้าย 3 หลัก:
                  001

                  ผลลัพธ์:
                  NB-AMZ26-001
              ================================================== */}
              <div>
                <label
                  htmlFor="assetCodeNumber"
                  className="mb-2 block font-medium"
                >
                  Asset Code
                </label>

                {/* ==================================================
                    แยก Prefix และเลขท้ายออกเป็นคนละช่อง
                ================================================== */}
                <div className="flex">
                  {/* ================================================
                      Prefix

                      ระบบสร้างอัตโนมัติตาม Asset Type + ปี
                      ผู้ใช้แก้ไม่ได้

                      ตัวอย่าง:
                      NB-AMZ26-
                  ================================================= */}
                  <div
                    className="
                      flex items-center
                      rounded-l-lg
                      border
                      border-r-0
                      border-gray-300
                      bg-gray-100
                      px-3
                      font-medium
                      text-gray-700
                    "
                  >
                    {assetCodePrefix}
                  </div>

                  {/* ================================================
                      Running Number

                      ผู้ใช้กรอกเอง
                      ต้องเป็นเลข 3 หลัก

                      ตัวอย่าง:
                      001
                      025
                      999
                  ================================================= */}
                  <input
                    id="assetCodeNumber"
                    // ใช้ text แทน number
                    // เพื่อให้เลข 001 ไม่กลายเป็น 1
                    type="text"
                    // มือถือจะแสดง Keyboard ตัวเลข
                    inputMode="numeric"
                    // กรอกได้สูงสุด 3 ตัว
                    maxLength={3}
                    // ค่าปัจจุบัน
                    value={assetCodeNumber}
                    onChange={(event) => {
                      // ============================================
                      // อนุญาตเฉพาะตัวเลข 0-9
                      //
                      // ถ้าพิมพ์:
                      // 0 -> 0
                      // 01 -> 01
                      // 001 -> 001
                      //
                      // ถ้าพิมพ์ตัวอักษร จะถูกตัดออก
                      // ============================================
                      const value = event.target.value.replace(/\D/g, "");

                      setAssetCodeNumber(value);
                    }}
                    placeholder="001"
                    className="
                      w-24
                      rounded-r-lg
                      border
                      border-gray-300
                      bg-white
                      p-3
                      text-center
                      font-medium
                      outline-none
                      focus:border-blue-500
                    "
                  />
                </div>

                {/* ==================================================
                    Preview Asset Code ตัวเต็ม
                ================================================== */}
                <p className="mt-2 text-sm text-gray-500">
                  Asset Code:{" "}
                  <span className="font-medium text-gray-700">
                    {assetCodeNumber ? fullAssetCode : `${assetCodePrefix}XXX`}
                  </span>
                </p>
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
              {group.title === "Assignment & Location" && (
                <div className="mb-5"><AssetLookups form={form} onChange={handleChange} /></div>
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
                            Asset Owner
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
                          user.full_name

                          สิ่งที่ Form เก็บ:
                          user.id
                      ================================= */}
                            {/* แสดงชื่อพนักงาน แต่เก็บ User ID เป็นค่าของตัวเลือก
    เช่น ผู้ใช้เห็นชื่อ "สมชาย" แต่ form.assetOwner เก็บ "27"
    ใช้ String ให้ตรงกับค่าที่ HTML select ส่งผ่าน onChange */}
                            {activeUsers.map((user) => (
                              <option key={user.id} value={String(user.id)}>
                                {user.full_name}
                              </option>
                            ))}
                          </select>

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
          <CollapsibleSection
            title="Documents & History"
            description="เอกสารประกอบและประวัติทรัพย์สิน"
          >
            <div>
              <label className="mb-2 block font-medium">Documents</label>

              <input
                type="file"
                multiple
                onChange={(event) =>
                  setDocuments(Array.from(event.target.files || []))
                }
                className={inputClass}
              />

              {documents.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  เลือกแล้ว {documents.length} ไฟล์
                </p>
              )}
            </div>

            <p className="mt-4 text-sm text-gray-500">
              ประวัติการมอบหมาย/คืน การซ่อม และ Audit Log จะเชื่อมหลังจากสร้าง
              Asset และมี ID ใน Database แล้ว
            </p>
          </CollapsibleSection>

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
                className="rounded-lg border border-gray-300 px-5 py-3 text-gray-700"
              >
                Back
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
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
