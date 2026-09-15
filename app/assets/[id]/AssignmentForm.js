"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssignmentForm({ assetId, currentId, users, locations }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState(currentId ? "change" : "assign");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/assets/${assetId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, action, expectedAssignmentId: currentId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save assignment");
      setMessage("บันทึกเรียบร้อย"); router.refresh();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="my-6 space-y-3 rounded border p-4">
    <h3 className="font-semibold">จัดการการมอบหมาย</h3>
    <label className="block">รายการ <select name="action" value={action} onChange={e => setAction(e.target.value)} className="border p-2">
      {currentId ? <><option value="change">Change assignee</option><option value="return">Return</option></> : <option value="assign">Assign</option>}
    </select></label>
    {action !== "return" && <>
      <label className="block">พนักงาน <select required name="assignedTo" className="border p-2" defaultValue=""><option value="">เลือกพนักงาน</option>{users.map(u => <option key={u.id} value={u.id}>{u.employee_code} — {u.full_name}{u.department_name ? ` (${u.department_name})` : ""}</option>)}</select></label>
      <label className="block">Location <select name="locationId" className="border p-2" defaultValue=""><option value="">ไม่ระบุ</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="block">หมายเหตุการมอบหมาย <textarea name="assignmentNotes" maxLength={10000} className="block w-full border p-2" /></label>
    </>}
    <label className="block">วันที่ <input required type="date" name="date" className="border p-2" /></label>
    {currentId && <label className="block">หมายเหตุการรับคืน <textarea name="returnNotes" maxLength={10000} className="block w-full border p-2" /></label>}
    <button disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
    <p role="status">{message}</p>
  </form>;
}
