"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_LABEL_PREFERENCES,
  LABEL_PREFERENCES_KEY,
  labelPreferenceStyle,
  labelPreferenceSnapshot,
  labelPreferenceServerSnapshot,
  normalizeLabelPreferences,
  preferencesFromSnapshot,
  subscribeLabelPreferences,
} from "@/lib/label-preferences";

const FIELDS = [
  ["qrSizeMm", "ขนาด QR (มม.)", 14, 23],
  ["codeFontPt", "ขนาดตัวอักษรรหัส (pt)", 7, 11],
  ["offsetXmm", "เลื่อนซ้าย/ขวา (มม.)", -4, 4],
  ["offsetYmm", "เลื่อนบน/ล่าง (มม.)", -4, 4],
];

export default function StickerSettings() {
  const snapshot = useSyncExternalStore(subscribeLabelPreferences, labelPreferenceSnapshot, labelPreferenceServerSnapshot);
  const [draft, setDraft] = useState(null);
  const settings = draft ?? preferencesFromSnapshot(snapshot);
  const [message, setMessage] = useState("");

  function save() {
    const normalized = normalizeLabelPreferences(settings);
    try {
      window.localStorage.setItem(LABEL_PREFERENCES_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event("amzap-label-preferences"));
      setDraft(null);
      setMessage("บันทึกแล้ว จะใช้กับหน้าพิมพ์สติ๊กเกอร์บนเบราว์เซอร์นี้");
    } catch {
      setMessage("เบราว์เซอร์ไม่อนุญาตให้บันทึกค่า กรุณาตรวจการตั้งค่าเว็บไซต์");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">สติ๊กเกอร์ม้วนขนาด 40 × 30 มม. ปรับเฉพาะ QR รหัส และตำแหน่งพิมพ์ โดยไม่เปลี่ยน Asset Code ใน QR</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label, minimum, maximum]) => (
            <label key={key} className="text-sm font-medium text-slate-700">{label}
              <input type="number" min={minimum} max={maximum} step="0.5" value={settings[key]} onChange={(event) => { setDraft((current) => ({ ...(current ?? settings), [key]: Number(event.target.value) })); setMessage(""); }} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" />
              <span className="mt-1 block text-xs text-slate-500">ช่วง {minimum} ถึง {maximum}</span>
            </label>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">ตัวอย่างตำแหน่ง · 40 × 30 มม.</p>
          <div style={labelPreferenceStyle(settings)} className="asset-label mx-auto shadow-md">
            <strong>F1-NB-041</strong>
            <div className="flex items-center justify-center bg-white text-center text-[8px] text-slate-500" style={{ width: `var(--label-qr-size)`, height: `var(--label-qr-size)`, transform: "translate(var(--label-offset-x), var(--label-offset-y))" }}>ตัวอย่างพื้นที่ QR</div>
          </div>
          <p className="mt-4 text-xs text-slate-500">ตรวจตำแหน่งจริงด้วยการพิมพ์ทดสอบ 1 ดวงก่อนพิมพ์จำนวนมาก</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">บันทึกสำหรับเครื่องพิมพ์นี้</button>
        <button type="button" onClick={() => { setDraft(DEFAULT_LABEL_PREFERENCES); setMessage("กดบันทึกเพื่อกลับไปใช้ค่าเริ่มต้น"); }} className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-50">คืนค่าเริ่มต้น</button>
        <Link href="/labels" className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-4 font-medium text-blue-700 hover:bg-blue-50">ไปหน้าพิมพ์สติ๊กเกอร์</Link>
      </div>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
