"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readApiResponse } from "@/lib/client-api";
import EmployeePicker from "@/app/components/EmployeePicker";
import { formatUserDisplayName } from "@/lib/user-display";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AssignmentForm({
  assetId,
  assetStatus,
  assetLocationId,
  itStockLocationId,
  currentId,
  currentAssignedDate,
  users,
  locations,
  today,
  canWrite,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [condition, setCondition] = useState("ready");
  const [issueEmployeeId, setIssueEmployeeId] = useState("");
  const [issueLocationId, setIssueLocationId] = useState("");
  const legacyReturn = !currentId && assetStatus === "In Use";
  const returning = Boolean(currentId) || legacyReturn;
  const canAssign =
    !returning &&
    itStockLocationId != null &&
    assetStatus === "In Stock" &&
    String(assetLocationId) === String(itStockLocationId);
  const canMarkReady =
    !returning &&
    itStockLocationId != null &&
    assetStatus === "Repair" &&
    String(assetLocationId) === String(itStockLocationId);
  const action = returning ? "return" : canMarkReady ? "ready" : "assign";
  const destinationLocations = locations.filter(
    (location) => String(location.id) !== String(itStockLocationId),
  );
  const activeUsers = users.filter((user) => user.is_active);

  if (!canWrite) {
    return <p className="my-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
      บัญชีนี้ดูข้อมูลการมอบหมายได้อย่างเดียว
    </p>;
  }

  if (!returning && !canAssign && !canMarkReady) {
    return <p className="my-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
      มอบหมายให้พนักงานได้เมื่อ Asset อยู่ในคลัง IT และมีสถานะ In Stock เท่านั้น
      {assetStatus === "Repair" ? " หลังซ่อมเสร็จให้เปลี่ยนสถานะเป็น In Stock ก่อน" : ""}
    </p>;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const employeeField = legacyReturn ? "returnedByUserId" : action === "assign" ? "assignedTo" : null;
    if (employeeField && !fields[employeeField]) {
      setMessage("กรุณาเลือกพนักงานก่อนบันทึก");
      return;
    }
    if (!window.confirm(returning
      ? `ยืนยันรับคืนเข้าคลัง IT เป็น${condition === "ready" ? " In Stock" : " Repair"}? Asset Owner จะถูกล้างอัตโนมัติ`
      : canMarkReady
        ? "ยืนยันว่าเครื่องซ่อมเสร็จและพร้อมเบิก?"
        : "ยืนยันเบิก Asset ให้พนักงาน? Asset Owner จะเปลี่ยนเป็นผู้รับอัตโนมัติ")) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/assets/${assetId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          action,
          expectedAssignmentId: currentId,
        }),
      });
      await readApiResponse(response);
      setMessage("บันทึกเรียบร้อย");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="my-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="font-semibold text-slate-800">
        {returning ? "รับคืนเข้าคลัง IT" : canMarkReady ? "ซ่อมเสร็จ · พร้อมเบิก" : "เบิกให้พนักงานจากคลัง IT"}
      </h3>
      <p className="text-sm text-slate-600">
        {returning
          ? "รับคืนครั้งเดียว ระบบปิด Assignment ย้ายเข้าคลัง IT และล้าง Asset Owner โดยเก็บผู้ส่งคืน เหตุผล และสภาพเครื่อง"
          : canMarkReady
            ? "บันทึกผลการซ่อมครั้งเดียว แล้วเปลี่ยนสถานะเป็น In Stock ในคลัง IT"
            : "เลือกพนักงานและ Location ครั้งเดียว ระบบบันทึก Assignment และตั้ง Asset Owner เป็นผู้รับใหม่ รหัส Asset ไม่เปลี่ยน"}
      </p>
      {legacyReturn && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Asset นี้ไม่มีประวัติการมอบหมายเดิม กรุณาเลือกคนที่ส่งคืนจริง ไม่อ้างอิง Asset Owner โดยอัตโนมัติ
        </p>
      )}
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

      {canMarkReady ? (
        <label className="block text-sm font-medium">
          ผลการซ่อม / ตรวจเช็ก <span className="text-red-600">*</span>
          <textarea
            required
            name="readyReason"
            maxLength={1000}
            rows={3}
            placeholder="เช่น เปลี่ยนแบตเตอรี่และทดสอบใช้งานแล้ว"
            className={inputClass}
          />
        </label>
      ) : returning ? (
        <div className="grid gap-4 md:grid-cols-2">
          {legacyReturn && (
            <div className="md:col-span-2">
              <EmployeePicker name="returnedByUserId" label="พนักงานที่ส่งคืนจริง" users={users} required />
            </div>
          )}
          <label className="block text-sm font-medium">
            สภาพเครื่อง <span className="text-red-600">*</span>
            <select
              required
              name="returnCondition"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className={inputClass}
            >
              <option value="ready">พร้อมใช้ → In Stock</option>
              <option value="repair">ต้องซ่อม → Repair</option>
            </select>
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            เหตุผลการรับคืน <span className="text-red-600">*</span>
            <textarea
              required
              name="returnReason"
              maxLength={1000}
              rows={3}
              placeholder="เช่น พนักงานลาออก เปลี่ยนเครื่อง หรือย้ายตำแหน่ง"
              className={inputClass}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            พนักงาน <span className="text-red-600">*</span>
            <select
              required
              name="assignedTo"
              value={issueEmployeeId}
              onChange={(event) => {
                const selectedId = event.target.value;
                const user = activeUsers.find((item) => String(item.id) === selectedId);
                setIssueEmployeeId(selectedId);
                const userLocationId = user?.location_id == null ? "" : String(user.location_id);
                setIssueLocationId(destinationLocations.some((location) => String(location.id) === userLocationId)
                  ? userLocationId
                  : "");
              }}
              className={inputClass}
            >
              <option value="">เลือกพนักงาน</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserDisplayName(user)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Location ปลายทาง <span className="text-red-600">*</span>
            <select required name="locationId" className={inputClass} value={issueLocationId} onChange={(event) => setIssueLocationId(event.target.value)}>
              <option value="">เลือก Location</option>
              {destinationLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {[location.name, location.building, location.floor].filter(Boolean).join(" / ")}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">เลือกพนักงานแล้วระบบเติม Location ให้อัตโนมัติ หากไม่ตรงสามารถเปลี่ยนได้</span>
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            หมายเหตุการมอบหมาย
            <textarea name="assignmentNotes" maxLength={10000} rows={3} className={inputClass} />
          </label>
        </div>
      )}
      <button
        disabled={busy || (returning ? legacyReturn && users.length === 0 : canMarkReady ? false : activeUsers.length === 0 || destinationLocations.length === 0)}
        className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "กำลังบันทึก…" : returning ? "รับคืนเข้าคลัง IT" : canMarkReady ? "บันทึกว่าพร้อมเบิก" : "เบิกให้พนักงาน"}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
    </form>
  );
}
