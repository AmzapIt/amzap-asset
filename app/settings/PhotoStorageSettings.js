"use client";

import { useState } from "react";
import { readApiResponse } from "@/lib/client-api";

export default function PhotoStorageSettings({ initialSettings, editable, driveCredentialsConfigured }) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checks, setChecks] = useState({});

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await readApiResponse(await fetch("/api/settings/photo-storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }));
      setSettings(result.settings);
      setChecks({});
      setMessage("บันทึกแล้ว มีผลกับการอัปโหลดรูปครั้งถัดไปบนเครื่องนี้");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function check(storage) {
    setChecking(storage);
    setError("");
    try {
      const result = await readApiResponse(await fetch("/api/settings/photo-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage, localPhotoDir: settings.localPhotoDir }),
      }));
      setChecks((current) => ({ ...current, [storage]: result }));
    } catch (caught) {
      setChecks((current) => ({ ...current, [storage]: { ok: false, message: caught.message } }));
    } finally {
      setChecking(null);
    }
  }

  const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500";
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        ค่านี้ใช้กับเครื่องที่กำลังเปิดเว็บอยู่เท่านั้น รูปเก่าจะไม่ถูกย้าย และการตั้งค่า local server จะไม่เปลี่ยน Vercel
      </div>
      <fieldset disabled={!editable || busy} className="grid gap-3 sm:grid-cols-2">
        {[
          ["google_drive", "Google Drive", "เหมาะกับเว็บ Vercel และการเปิดรูปจากหลายเครื่อง"],
          ["supabase", "Supabase Storage", "ใช้ร่วมกันได้ทั้ง local server, Vercel และโทรศัพท์"],
          ["local", "Local server", "เก็บไฟล์ลงโฟลเดอร์บนเครื่องเซิร์ฟเวอร์นี้"],
        ].map(([value, label, description]) => (
          <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${settings.photoStorageMode === value ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <input type="radio" name="photoStorageMode" value={value} checked={settings.photoStorageMode === value} onChange={() => setSettings((current) => ({ ...current, photoStorageMode: value }))} className="mt-1 accent-blue-700" />
            <span><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm text-slate-600">{description}</span></span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Google Drive</h3>
          <p className="mt-1 text-sm text-slate-600">OAuth Client ID, Client Secret และ Refresh Token ต้องตั้งใน environment ของเซิร์ฟเวอร์ จะไม่แสดงค่าลับบนหน้านี้</p>
          <p className={`mt-3 text-sm font-medium ${driveCredentialsConfigured ? "text-emerald-700" : "text-amber-700"}`}>{driveCredentialsConfigured ? "ตั้งค่า OAuth ครบแล้ว" : "ยังตั้งค่า OAuth ไม่ครบ"}</p>
          <label className="mt-4 block text-sm font-medium">Google Drive Folder ID (เว้นว่าง = My Drive หลัก)
            <input value={settings.googleDriveFolderId} onChange={(event) => setSettings((current) => ({ ...current, googleDriveFolderId: event.target.value }))} disabled={!editable || busy} className={fieldClass} placeholder="Folder ID ไม่ใช่ path ในเครื่อง" />
          </label>
          <button type="button" onClick={() => check("google_drive")} disabled={Boolean(checking) || !driveCredentialsConfigured} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{checking === "google_drive" ? "กำลังตรวจ..." : "ทดสอบการเชื่อมต่อ"}</button>
          {checks.google_drive && <p role="status" className={`mt-2 text-sm ${checks.google_drive.ok ? "text-emerald-700" : "text-red-700"}`}>{checks.google_drive.message}</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Local server</h3>
          <p className="mt-1 text-sm text-slate-600">ใช้ path แบบเต็มนอกโฟลเดอร์โปรเจกต์ เช่น D:\\AMZAP-Photos และต้องให้โปรเซสเว็บอ่าน/เขียนได้</p>
          <label className="mt-4 block text-sm font-medium">Path เก็บรูปบนเซิร์ฟเวอร์
            <input value={settings.localPhotoDir} onChange={(event) => {
              setSettings((current) => ({ ...current, localPhotoDir: event.target.value }));
              setChecks((current) => ({ ...current, local: null }));
            }} disabled={!editable || busy} className={fieldClass} placeholder="D:\\AMZAP-Photos หรือ \\\\server\\share\\Asset" />
          </label>
          <button type="button" onClick={() => check("local")} disabled={Boolean(checking) || !settings.localPhotoDir.trim()} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{checking === "local" ? "กำลังตรวจ..." : "ตรวจสิทธิ์ path ที่กรอก"}</button>
          {checks.local && <p role="status" className={`mt-2 text-sm ${checks.local.ok ? "text-emerald-700" : "text-red-700"}`}>{checks.local.message}</p>}
        </section>
      </div>
      {!editable && <p className="text-sm text-amber-800">บน Vercel หน้านี้อ่านค่าได้อย่างเดียว หากต้องเปลี่ยนให้แก้ Environment Variables ใน Vercel</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {editable && <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? "กำลังบันทึก..." : "บันทึกการจัดเก็บรูป"}</button>}
    </form>
  );
}
