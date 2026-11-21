"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiResponse } from "@/lib/client-api";

// เปิด/ปิดปุ่ม "วางข้อมูลจากสคริปต์" ในหน้าแก้ไข Asset และให้ดาวน์โหลดสคริปต์
export default function MachineSpecsSettings({ initialEnabled }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    const next = !enabled;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = await readApiResponse(await fetch("/api/settings/machine-specs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      }));
      setEnabled(data.enabled);
      setMessage(data.enabled ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว");
      router.refresh();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="เปิดใช้ปุ่มวางข้อมูลจากสคริปต์"
          disabled={busy}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${enabled ? "bg-blue-700" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</p>
          <p className="text-sm text-slate-600">
            เมื่อเปิด หน้าแก้ไข Asset จะมีปุ่ม &quot;วางข้อมูลจากสคริปต์&quot; เหนือหัวข้อ Technical Information
          </p>
        </div>
        {message && <span className="text-sm text-emerald-700">{message}</span>}
        {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a href="/tools/amzap-specs-windows.bat" download className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50">
          <span className="font-semibold text-blue-800">ดาวน์โหลดสคริปต์ Windows</span>
          <span className="mt-1 block text-sm text-slate-600">ดับเบิลคลิกไฟล์ .bat บนเครื่องที่ต้องการตรวจ</span>
        </a>
        <a href="/tools/amzap-specs-mac.sh" download className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50">
          <span className="font-semibold text-blue-800">ดาวน์โหลดสคริปต์ Mac</span>
          <span className="mt-1 block text-sm text-slate-600">
            เปิด Terminal แล้วพิมพ์ <code className="rounded bg-slate-100 px-1">bash ~/Downloads/amzap-specs-mac.sh</code>
          </span>
        </a>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>รันสคริปต์บนเครื่องที่ต้องการตรวจ สคริปต์จะคัดลอกข้อมูลไว้ให้</li>
        <li>เปิดหน้าแก้ไข Asset ของเครื่องนั้นบนเครื่องเดียวกัน</li>
        <li>กด &quot;วางข้อมูลจากสคริปต์&quot; ระบบจะกรอกและกางหัวข้อ Technical Information กับ Software ให้ ตรวจค่า แล้วกดบันทึก</li>
      </ol>
      <p className="text-xs text-slate-500">
        Technical: Hostname, IP, MAC (Wi-Fi), OS, CPU, RAM, Storage, BIOS, Resolution และขนาดจอ (Windows) ·
        Software: Office Product, Version, License, Account และ Windows Activation (Mac ได้เฉพาะ Office Version / Account) ·
        VLAN และ Management IP ต้องกรอกเอง · ถ้า Serial ไม่ตรงกับ Asset จะเตือนก่อนกรอก
      </p>
    </div>
  );
}
