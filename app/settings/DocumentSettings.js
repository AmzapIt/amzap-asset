"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiResponse } from "@/lib/client-api";

// ตั้งชื่อผู้เซ็นฝั่ง IT ครั้งเดียว ใช้ในใบคืน ใบรับมอบ ใบขอเบิก และใบตรวจยืนยัน
export default function DocumentSettings({ initialName }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = await readApiResponse(await fetch("/api/settings/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itSignerName: name }),
      }));
      setName(data.itSignerName);
      setMessage("บันทึกแล้ว");
      router.refresh();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-slate-200 p-4">
      <label className="block text-sm font-medium">
        ชื่อผู้เซ็นฝั่ง IT
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
          placeholder="เว้นว่างไว้ = ให้เขียนชื่อเองในเอกสาร"
          className="mt-1 min-h-11 w-full max-w-md rounded-lg border border-slate-300 px-3" />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        ใช้ในใบคืนทรัพย์สิน ใบตรวจยืนยัน และเป็นค่าเริ่มต้นในใบรับมอบ / ใบขอเบิก (แก้ทับในฟอร์มได้)
      </p>
      <button disabled={busy} className="mt-3 min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50">
        บันทึก
      </button>
      {message && <span className="ml-3 text-sm text-emerald-700">{message}</span>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
