"use client";

import { useState } from "react";
import { isViewableAssetDocumentUrl } from "@/lib/asset-photo-links";
import MachineSpecsPaste from "@/app/assets/MachineSpecsPaste";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

const technicalFields = [
  ["hostname", "Hostname"], ["ipAddress", "IP Address"],
  ["macAddress", "MAC Address"], ["operatingSystem", "Operating System"],
  ["cpu", "CPU"], ["ramGb", "RAM (GB)", "number"],
  ["storageGb", "Storage (GB)", "number"], ["biosFirmware", "BIOS / Firmware"],
  ["vlan", "VLAN", "number"], ["managementIp", "Management IP"],
  // Rack / Rack U ซ่อนไว้ (คอลัมน์ใน DB ยังอยู่ ค่าเดิมยังถูกส่งกลับตอนบันทึก)
  ["screenSize", "Screen Size"], ["resolution", "Resolution"],
];

const softwareFields = [
  ["officeProduct", "Office Product"], ["officeVersion", "Office Version"],
  ["officeLicense", "Office License"], ["officeAccount", "Office Account"],
  ["windowsActivation", "Windows Activation"],
];

const securityFields = [
  ["encryptionType", "Encryption Type"], ["antivirusEdr", "Antivirus / EDR"],
  ["lastSecurityCheck", "Last Security Check", "date"],
  ["patchStatus", "Patch Status"], ["localAdminPolicy", "Local Admin Policy", "textarea"],
  ["dataClassification", "Data Classification"],
  ["lastAssetCheck", "Last Asset Check", "date"],
  ["securityNotes", "Security Notes", "textarea"],
];

function Field({ name, label, type = "text", form, onChange, ...props }) {
  const common = { id: name, name, value: form[name] ?? "", onChange, className: inputClass, ...props };
  return <label className="block"><span className="mb-2 block font-medium">{label}</span>{type === "textarea" ? <textarea {...common} rows={3} /> : <input {...common} type={type} />}</label>;
}

function Section({ title, description, children, open, onToggle }) {
  return <details open={open} onToggle={onToggle} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm"><summary className="cursor-pointer px-4 py-4 text-lg font-semibold sm:px-6 sm:py-5">{title}</summary><div className="border-t border-slate-200 px-4 py-5 sm:px-6"><p className="mb-5 text-sm text-slate-500">{description}</p>{children}</div></details>;
}

export default function AssetAdditionalFields({
  form, onChange, sections = ["technical", "software", "security", "documents", "maintenance"],
  existingDocuments = [], existingMaintenance = [], allowRepairDispatch = false,
  machineSpecsEnabled = false,
}) {
  // กางหัวข้อ Technical / Software หลังวางข้อมูลจากสคริปต์ ให้เห็นค่าที่กรอก
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [softwareOpen, setSoftwareOpen] = useState(false);

  return <>
    {machineSpecsEnabled && sections.includes("technical") &&
      <MachineSpecsPaste form={form} onChange={onChange} onApplied={() => { setTechnicalOpen(true); setSoftwareOpen(true); }} />}
    {sections.includes("technical") && <Section title="Technical Information" description="ข้อมูล Hardware, Network และระบบปฏิบัติการ" open={technicalOpen} onToggle={(e) => setTechnicalOpen(e.currentTarget.open)}>
      <div className="grid gap-5 md:grid-cols-2">{technicalFields.map(([name, label, type]) => <Field key={name} name={name} label={label} type={type} form={form} onChange={onChange} min={type === "number" ? (name === "vlan" || name === "rackU" ? "1" : "0") : undefined} max={name === "vlan" ? "4094" : undefined} step={name === "ramGb" || name === "storageGb" ? "0.01" : undefined} />)}</div>
    </Section>}
    {sections.includes("software") && <Section title="Software" description="Microsoft Office และการ Activate Windows" open={softwareOpen} onToggle={(e) => setSoftwareOpen(e.currentTarget.open)}>
      <div className="grid gap-5 md:grid-cols-2">{softwareFields.map(([name, label]) => <Field key={name} name={name} label={label} form={form} onChange={onChange} />)}</div>
    </Section>}
    {sections.includes("security") &&<Section title="Security / Compliance" description="ข้อมูล Encryption, Endpoint Protection และการตรวจสอบล่าสุด">
      <div className="grid gap-5 md:grid-cols-2"><label className="block"><span className="mb-2 block font-medium">Encryption</span><select name="encryptionEnabled" value={form.encryptionEnabled ?? ""} onChange={onChange} className={inputClass}><option value="">ยังไม่ระบุ</option><option value="true">Enabled</option><option value="false">Disabled</option></select></label>{securityFields.map(([name, label, type]) => <Field key={name} name={name} label={label} type={type} form={form} onChange={onChange} />)}</div>
    </Section>}
    {sections.includes("documents") && <Section title="Documents" description="เพิ่มลิงก์ HTTPS ของเอกสารที่เก็บใน Google Drive หรือพื้นที่จัดเก็บที่ได้รับอนุญาต">
      {existingDocuments.length > 0 && <div className="mb-5 space-y-2">{existingDocuments.map((doc) => isViewableAssetDocumentUrl(doc.storage_path) ? <a key={doc.id} href={doc.storage_path} target="_blank" rel="noreferrer" className="block rounded-lg border p-3 text-blue-700 hover:bg-blue-50">{doc.file_name}{doc.document_type ? ` · ${doc.document_type}` : ""}</a> : <div key={doc.id} className="rounded-lg border p-3">{doc.file_name}{doc.document_type ? ` · ${doc.document_type}` : ""}</div>)}</div>}
      <div className="grid gap-5 md:grid-cols-2"><Field name="documentType" label="Document Type" form={form} onChange={onChange} /><Field name="documentName" label="Document Name" form={form} onChange={onChange} /><div className="md:col-span-2"><Field name="documentUrl" label="Document URL (HTTPS)" type="url" form={form} onChange={onChange} placeholder="https://drive.google.com/..." /></div></div>
      <p className="mt-3 text-xs text-slate-500">เว้นทั้งสามช่องว่างหากยังไม่มีเอกสาร ระบบยังไม่อัปโหลดไฟล์จากเครื่องในรอบนี้</p>
    </Section>}
    {sections.includes("maintenance") && <Section title="Maintenance" description="เพิ่มประวัติการซ่อมหรือบำรุงรักษาใหม่ รายการเดิมจะไม่ถูกเขียนทับ">
      {existingMaintenance.length > 0 && <p className="mb-4 text-sm text-slate-600">มีประวัติเดิม {existingMaintenance.length} รายการ สามารถดูรายละเอียดทั้งหมดที่หน้า Asset Detail</p>}
      <div className="grid gap-5 md:grid-cols-2"><Field name="maintenanceType" label="Maintenance Type" form={form} onChange={onChange} /><label className="block"><span className="mb-2 block font-medium">Status</span><select name="maintenanceStatus" value={form.maintenanceStatus || "Open"} onChange={onChange} className={inputClass}>{["Open", "In Progress", "Completed", "Cancelled"].map((status) => <option key={status}>{status}</option>)}</select></label><Field name="maintenanceReportedAt" label="Reported Date" type="date" form={form} onChange={onChange} /><Field name="maintenanceCompletedAt" label="Completed Date" type="date" form={form} onChange={onChange} min={form.maintenanceReportedAt || undefined} /><Field name="maintenanceCost" label="Cost (THB)" type="number" min="0" step="0.01" form={form} onChange={onChange} /><div className="md:col-span-2"><Field name="maintenanceDescription" label="Description" type="textarea" form={form} onChange={onChange} /></div><div className="md:col-span-2"><Field name="maintenanceNotes" label="Notes" type="textarea" form={form} onChange={onChange} /></div></div>
      {allowRepairDispatch && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-950">บันทึกการส่งซ่อม</h3>
        <p className="mt-1 text-sm text-amber-900">
          กรอกรายละเอียดการซ่อม วันที่ส่ง และร้าน/ผู้รับซ่อม แล้วตั้ง Asset Status เป็น Repair และ Maintenance Status เป็น In Progress ก่อนบันทึก
          {form.status === "In Use" ? " ถ้ายังเป็น In Use ต้องรับคืนเข้าคลัง IT ก่อนส่งซ่อม" : ""}
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field name="maintenanceSentAt" label="วันที่ส่งซ่อม" type="date" form={form} onChange={onChange} />
          <Field name="maintenanceSentTo" label="ร้าน / ผู้รับซ่อม" form={form} onChange={onChange} maxLength={255} />
          <Field name="maintenanceExpectedReturnAt" label="กำหนดรับคืน" type="date" form={form} onChange={onChange} min={form.maintenanceSentAt || undefined} />
        </div>
        <p className="mt-3 text-xs text-amber-900">เอกสารส่งซ่อมสามารถเพิ่มเป็นลิงก์ HTTPS ในหมวด Documents ได้</p>
      </div>}
      <p className="mt-3 text-xs text-slate-500">ถ้าไม่ต้องการเพิ่มประวัติใหม่ ให้เว้นรายละเอียด Maintenance ว่างไว้</p>
    </Section>}
  </>;
}
