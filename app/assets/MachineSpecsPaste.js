"use client";

import { useState } from "react";
import { assetIdentityChanges, compareSerial, parseMachineSpecs } from "@/lib/machine-specs";

// ปุ่มวางข้อมูลจากสคริปต์ตรวจเครื่อง: อ่าน Clipboard แล้วกรอกช่อง Technical Information และ Software
// ยังไม่บันทึกจนกว่าผู้ใช้จะกดบันทึกฟอร์มเอง
export default function MachineSpecsPaste({ form, onChange, onApplied }) {
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function apply(input) {
    setMessage("");
    setError("");
    let specs;
    try {
      specs = parseMachineSpecs(input);
    } catch (e) {
      setError(e.message);
      return;
    }

    const serial = compareSerial(form.serialNumber, specs.serialNumber);
    if (serial === "mismatch" && !window.confirm(
      `Serial ของเครื่องนี้ (${specs.serialNumber}) ไม่ตรงกับ Asset นี้ (${form.serialNumber})\n` +
      "อาจกำลังกรอกผิดเครื่อง ต้องการกรอกข้อมูลต่อหรือไม่?",
    )) {
      setError("ยกเลิกแล้ว ไม่ได้กรอกข้อมูล");
      return;
    }

    // ฟอร์มให้ตรวจค่าก่อนกดบันทึกอยู่แล้ว จึงเขียนทับ Brand / Model ได้เลย · Serial เติมเฉพาะตอนว่าง
    const identity = assetIdentityChanges(form, specs, { overwrite: true });
    const entries = [
      ...Object.entries(identity).map(([name, change]) => [name, change.to]),
      ...Object.entries(specs.values),
    ];
    for (const [name, value] of entries) onChange({ target: { name, value } });
    // ให้ API จดวันที่นำเข้าสเปกเมื่อกดบันทึกฟอร์ม
    onChange({ target: { name: "specsImported", value: true } });
    onApplied?.();
    setManual(false);
    setText("");
    const serialNote = serial === "match" ? " · Serial ตรงกับ Asset"
      : identity.serialNumber ? ` · เติม Serial ${specs.serialNumber} ให้แล้ว` : "";
    setMessage(`กรอกแล้ว ${entries.length} ช่อง ตรวจค่าแล้วกดบันทึก${serialNote}`);
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("unavailable");
      apply(await navigator.clipboard.readText());
    } catch {
      // เบราว์เซอร์ไม่อนุญาตอ่าน Clipboard (เช่น เปิดผ่าน http://IP) ให้วางเองแทน
      setManual(true);
      setError("");
      setMessage("เบราว์เซอร์ไม่อนุญาตให้อ่าน Clipboard กด Ctrl+V ในช่องด้านล่าง");
    }
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={pasteFromClipboard}
          className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
          วางข้อมูลจากสคริปต์
        </button>
        <span className="text-sm text-blue-900">รันสคริปต์ตรวจเครื่องก่อน (ดาวน์โหลดได้ที่ Settings → สคริปต์ตรวจเครื่อง)</span>
      </div>
      {manual && <div className="mt-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
          aria-label="วางข้อมูลจากสคริปต์"
          placeholder='{"amzapSpecs":1,...}'
          className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs" />
        <button type="button" onClick={() => apply(text)} disabled={!text.trim()}
          className="mt-2 min-h-11 rounded-lg border border-blue-300 bg-white px-4 font-medium text-blue-800 disabled:opacity-50">
          ใช้ข้อมูลนี้
        </button>
      </div>}
      {message && <p className="mt-2 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
