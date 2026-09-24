"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AssignmentForm({
  assetId,
  assetStatus,
  currentId,
  currentAssigneeId,
  currentAssignedDate,
  users,
  locations,
  today,
  canWrite,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // เงื่อนไขนี้ควบคุมเฉพาะสิ่งที่แสดงใน UI เท่านั้น
  // Permission, สถานะ Asset และความถูกต้องของ Assignment จะถูกตรวจซ้ำที่ Server
  const statusAllowsAssignment = ["In Stock", "Spare", "In Use"].includes(
    assetStatus,
  );
  const [action, setAction] = useState(
    currentId && !statusAllowsAssignment
      ? "return"
      : currentId
        ? "change"
        : "assign",
  );

  if (!canWrite) {
    return (
      <p className="my-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        บัญชีนี้ดูข้อมูลการมอบหมายได้อย่างเดียว
      </p>
    );
  }

  if (!currentId && !statusAllowsAssignment) {
    return (
      <p className="my-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Asset สถานะ {assetStatus} ยังไม่สามารถมอบหมายได้
      </p>
    );
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    const actionLabel =
      action === "return"
        ? "คืน Asset"
        : action === "change"
          ? "เปลี่ยนผู้ถือครอง"
          : "มอบหมาย Asset";

    if (!window.confirm(`ยืนยันการ${actionLabel}?`)) return;

    setBusy(true);
    setMessage("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));

    try {
      // expectedAssignmentId ป้องกัน Stale Update หาก Assignment ถูกเปลี่ยน
      // หลังเปิดหน้านี้ ส่วน action "change" จะปิดแถวเดิมและสร้างประวัติแถวใหม่
      const response = await fetch(`/api/assets/${assetId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          action,
          expectedAssignmentId: currentId,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save assignment");
      }

      setMessage("บันทึกเรียบร้อย");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "Unable to save assignment");
    } finally {
      setBusy(false);
    }
  }

  const selectableUsers = users.filter(
    (user) => String(user.id) !== String(currentAssigneeId),
  );

  return (
    <form
      onSubmit={submit}
      className="my-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
    >
      <h3 className="font-semibold text-slate-800">จัดการการมอบหมาย</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          รายการ
          <select
            name="action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className={inputClass}
          >
            {currentId ? (
              <>
                {statusAllowsAssignment && (
                  <option value="change">เปลี่ยนผู้ถือครอง</option>
                )}
                <option value="return">คืน Asset</option>
              </>
            ) : (
              <option value="assign">มอบหมาย Asset</option>
            )}
          </select>
        </label>

        <label className="block text-sm font-medium">
          วันที่
          <input
            required
            type="date"
            name="date"
            min={currentId ? currentAssignedDate : undefined}
            max={today}
            defaultValue={today}
            className={inputClass}
          />
        </label>
      </div>

      {action !== "return" && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            พนักงาน
            <select
              required
              name="assignedTo"
              className={inputClass}
              defaultValue=""
            >
              <option value="">เลือกพนักงาน</option>
              {selectableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.employee_code} — {user.full_name}
                  {user.department_name ? ` (${user.department_name})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Location
            <select name="locationId" className={inputClass} defaultValue="">
              <option value="">ไม่ระบุ</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {[location.name, location.building, location.floor]
                    .filter(Boolean)
                    .join(" / ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium md:col-span-2">
            หมายเหตุการมอบหมาย
            <textarea
              name="assignmentNotes"
              maxLength={10000}
              rows={3}
              className={inputClass}
            />
          </label>
        </div>
      )}

      {currentId && (
        <label className="block text-sm font-medium">
          หมายเหตุการรับคืน
          <textarea
            name="returnNotes"
            maxLength={10000}
            rows={3}
            className={inputClass}
          />
        </label>
      )}

      <button
        disabled={busy || (action !== "return" && selectableUsers.length === 0)}
        className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>

      {action !== "return" && selectableUsers.length === 0 && (
        <p className="text-sm text-amber-700">
          ไม่มีพนักงาน Active คนอื่นที่สามารถเลือกได้
        </p>
      )}

      <p role="status" aria-live="polite" className="text-sm text-slate-700">
        {message}
      </p>
    </form>
  );
}
