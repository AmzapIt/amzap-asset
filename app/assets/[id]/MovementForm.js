"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserDisplayName } from "@/lib/user-display";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const idValue = (value) => (value == null ? "" : String(value));

export default function MovementForm({
  assetId,
  currentLocationId,
  currentDepartmentId,
  currentOwnerId,
  locations,
  departments,
  users,
  today,
  canWrite,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [toLocationId, setToLocationId] = useState(
    idValue(currentLocationId),
  );
  const [toDepartmentId, setToDepartmentId] = useState(
    idValue(currentDepartmentId),
  );
  const [toOwnerId, setToOwnerId] = useState(idValue(currentOwnerId));

  if (!canWrite) {
    return (
      <p className="mb-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        บัญชีนี้ดูประวัติ Movement ได้อย่างเดียว
      </p>
    );
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    const form = new FormData(event.currentTarget);
    const hasChange =
      toLocationId !== idValue(currentLocationId) ||
      toDepartmentId !== idValue(currentDepartmentId) ||
      toOwnerId !== idValue(currentOwnerId);

    if (!hasChange) {
      setMessage("กรุณาเปลี่ยน Owner, Department หรือ Location อย่างน้อย 1 รายการ");
      return;
    }

    if (!window.confirm("ยืนยันการบันทึก Asset Movement?")) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/assets/${assetId}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementDate: form.get("movementDate"),
          reason: form.get("reason"),
          notes: form.get("notes"),
          toLocationId,
          toDepartmentId,
          toOwnerId,
          // Expected values prevent an old browser tab from overwriting a
          // newer Movement saved by another user.
          expectedLocationId: idValue(currentLocationId),
          expectedDepartmentId: idValue(currentDepartmentId),
          expectedOwnerId: idValue(currentOwnerId),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save Asset Movement");
      }

      setMessage("บันทึก Asset Movement เรียบร้อย");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "Unable to save Asset Movement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5"
    >
      <div>
        <h3 className="font-semibold text-slate-900">บันทึก Asset Movement</h3>
        <p className="mt-1 text-sm text-slate-600">
          เปลี่ยนสถานที่ หน่วยงานเจ้าของ หรือ Asset Owner พร้อมเก็บค่าก่อน–หลัง
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Location ปลายทาง
          <select
            value={toLocationId}
            onChange={(event) => setToLocationId(event.target.value)}
            className={inputClass}
          >
            <option value="">ไม่ระบุ Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {[location.name, location.building, location.floor, location.room]
                  .filter(Boolean)
                  .join(" / ")}
                {!location.is_active ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Owning Department
          <select
            value={toDepartmentId}
            onChange={(event) => setToDepartmentId(event.target.value)}
            className={inputClass}
          >
            <option value="">ไม่ระบุ Department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
                {!department.is_active ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Asset Owner
          <select
            value={toOwnerId}
            onChange={(event) => setToOwnerId(event.target.value)}
            className={inputClass}
          >
            <option value="">ไม่มี Asset Owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.employee_code ? `${user.employee_code} — ` : ""}
                {formatUserDisplayName(user)}
                {user.department_name ? ` (${user.department_name})` : ""}
                {!user.is_active ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Owner เป็นผู้รับผิดชอบ Asset ไม่ใช่ผู้ถือครองจาก Assignment
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          วันที่ย้าย
          <input
            required
            type="date"
            name="movementDate"
            max={today}
            defaultValue={today}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          เหตุผล
          <input
            required
            name="reason"
            maxLength={1000}
            placeholder="เช่น ย้ายเครื่องไปใช้งานที่โรงงาน 2"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        หมายเหตุเพิ่มเติม
        <textarea name="notes" maxLength={10000} rows={3} className={inputClass} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก…" : "บันทึก Movement"}
        </button>
        <p role="status" aria-live="polite" className="text-sm text-slate-700">
          {message}
        </p>
      </div>
    </form>
  );
}
