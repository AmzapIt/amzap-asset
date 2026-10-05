"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmployeePicker from '@/app/components/EmployeePicker';
import { readApiResponse } from '@/lib/client-api';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5';
const emptyItem = () => ({ name: '', quantity: 1, returnedAssetId: '', replacementAssetId: '', details: '' });

export default function RequisitionForm({
  users, types, stockAssets, heldAssets, initialUserId, today, initialRequest = null,
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialRequest?.request_payload?.userId || initialUserId);
  const [kind, setKind] = useState(initialRequest?.request_kind || 'additional');
  const [items, setItems] = useState(() => initialRequest?.items.map((item, index) => ({
    ...item,
    returnedAssetId: item.returnedAssetId || '',
    replacementAssetId: item.replacementAssetId ||
      initialRequest.request_payload?.items?.[index]?.originalAssetId || '',
  })) || [emptyItem()]);
  const [itStaffName, setItStaffName] = useState(initialRequest?.it_staff_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const attempt = useRef(null);
  const employee = users.find((u) => u.id === userId);

  function updateItem(index, key, value) {
    setItems((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!userId) { setError('กรุณาเลือกพนักงาน'); return; }
    const form = new FormData(event.currentTarget);
    const payload = { requestId: initialRequest?.request_id || '',
      userId, kind, requestedDate: form.get('requestedDate'), reason: form.get('reason'), itStaffName,
      items: items.map((item) => ({
        name: item.name, quantity: Number(item.quantity), details: item.details,
        returnedAssetId: kind === 'replacement' ? item.returnedAssetId : '',
        replacementAssetId: kind === 'replacement' ? item.replacementAssetId : '',
      })) };
    const signature = JSON.stringify(payload);
    if (!initialRequest && attempt.current?.signature !== signature) attempt.current = { signature, requestId: crypto.randomUUID() };
    if (!initialRequest) payload.requestId = attempt.current.requestId;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await readApiResponse(await fetch(
        initialRequest ? `/api/asset-requisitions/${initialRequest.id}` : '/api/asset-requisitions',
        { method: initialRequest ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload) },
      ));
      router.push(`/reports/requisitions/${data.requisition.id}`);
      router.refresh();
    } catch (e) {
      setError(e.message);
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="create-request-heading">
      <h2 id="create-request-heading" className="text-xl font-bold">
        {initialRequest ? `แก้ไขใบขอเบิก REQ-${initialRequest.id.padStart(6, '0')}` : 'สร้างใบขอเบิก / เปลี่ยนอุปกรณ์'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">บันทึกแล้วพิมพ์ให้ผู้ขอ ผู้อนุมัติ และเจ้าหน้าที่ IT เซ็นบนกระดาษ ไม่ใช่การเบิกจ่ายหรือรับคืนจริง</p>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          <div className="grid gap-4 md:grid-cols-2">
            <EmployeePicker label="พนักงานผู้ขอ" users={users} value={userId} onChange={(value) => {
              setUserId(value);
              setItems((rows) => rows.map((row) => ({ ...row, returnedAssetId: '', returnedAssetCode: '' })));
            }} required disabled={busy} />
            <label className="text-sm font-medium">วันที่ขอ *<input name="requestedDate" type="date" min="1900-01-01" defaultValue={initialRequest?.requested_date || today} required className={inputClass} /></label>
            <label className="text-sm font-medium">ประเภทคำขอ *
              <select value={kind} onChange={(e) => {
                setKind(e.target.value);
                setItems((rows) => rows.map((row) => e.target.value === 'replacement'
                  ? { ...row, quantity: 1 }
                  : { ...row, returnedAssetId: '', replacementAssetId: '', returnedAssetCode: '', replacementAssetCode: '' }));
              }} className={inputClass}>
                <option value="additional">ขอเพิ่ม</option><option value="replacement">เปลี่ยนทดแทน / คืน</option>
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>แผนก: {employee?.department_name || '—'}</p>
              <p className="mt-1">สถานที่: {employee?.location_name || '—'}</p>
            </div>
          </div>
          <datalist id="request-equipment-types">{types.map((t) => <option key={t.id} value={t.name} />)}</datalist>
          <div className="space-y-3">
            {items.map((item, index) => (
              <fieldset key={index} className="rounded-xl border border-slate-200 p-4">
                <legend className="px-2 text-sm font-semibold">อุปกรณ์รายการที่ {index + 1}</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-medium md:col-span-2">ประเภท / ชื่ออุปกรณ์ *
                    <input list="request-equipment-types" required maxLength={200} value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="เช่น Monitor, Notebook หรือ Mouse" className={inputClass} />
                  </label>
                  <label className="text-sm font-medium">จำนวน *<input type="number" min="1" max={kind === 'replacement' ? 1 : 999} step="1" required value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className={inputClass} /></label>
                  {kind === 'replacement' && <label className="text-sm font-medium md:col-span-3">Asset ทดแทนจากคลัง IT *
                    <select required value={item.replacementAssetId} onChange={(e) => updateItem(index, 'replacementAssetId', e.target.value)} className={inputClass}>
                      <option value="">เลือก Asset Code จากคลัง IT</option>
                      {item.replacementAssetId && !stockAssets.some((asset) => asset.id === item.replacementAssetId) &&
                        <option value={item.replacementAssetId}>{item.replacementAssetCode || item.originalAssetCode} (รายการเดิม)</option>}
                      {stockAssets.map((asset) => <option key={asset.id} value={asset.id}>
                        {[asset.asset_code, asset.asset_name, asset.serial_number && `S/N ${asset.serial_number}`].filter(Boolean).join(' · ')}
                      </option>)}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {stockAssets.length
                        ? 'แสดงเฉพาะเครื่องสถานะ In Stock ในคลัง IT ระบบจะบันทึก Asset Code โดยไม่เปลี่ยนสถานะเครื่อง'
                        : 'ขณะนี้ไม่มี Asset สถานะ In Stock ในคลัง IT ให้เลือก'}
                    </span>
                  </label>}
                  {kind === 'replacement' && <label className="text-sm font-medium md:col-span-3">Asset ที่พนักงานคืน *
                    <select required value={item.returnedAssetId} onChange={(e) => updateItem(index, 'returnedAssetId', e.target.value)} className={inputClass}>
                      <option value="">เลือก Asset Code ที่พนักงานถืออยู่</option>
                      {item.returnedAssetId && !heldAssets.some((asset) => asset.id === item.returnedAssetId) &&
                        <option value={item.returnedAssetId}>{item.returnedAssetCode} (รายการเดิม)</option>}
                      {heldAssets.filter((asset) => asset.holder_id === userId).map((asset) => <option key={asset.id} value={asset.id}>
                        {[asset.asset_code, asset.asset_name, asset.serial_number && `S/N ${asset.serial_number}`].filter(Boolean).join(' · ')}
                      </option>)}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-slate-500">เลือกได้เฉพาะ Asset ที่ระบบระบุว่าพนักงานคนนี้ถือครอง</span>
                  </label>}
                  <label className="text-sm font-medium md:col-span-3">รายละเอียด / สเปกที่ต้องการ
                    <input maxLength={500} value={item.details} onChange={(e) => updateItem(index, 'details', e.target.value)} className={inputClass} />
                  </label>
                </div>
                {items.length > 1 && <button type="button" className="mt-3 text-sm text-red-700 hover:underline" onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>ลบรายการที่ {index + 1}</button>}
              </fieldset>
            ))}
            <button type="button" disabled={items.length >= 20} onClick={() => setItems((rows) => [...rows, emptyItem()])} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50">+ เพิ่มรายการอุปกรณ์ ({items.length}/20)</button>
          </div>
          <label className="block text-sm font-medium">เหตุผลที่ขอ *
            <textarea name="reason" required maxLength={2000} rows={3} defaultValue={initialRequest?.reason || ''} className={inputClass} placeholder="เช่น เพิ่มจอสำหรับทำงาน หรือเปลี่ยนเครื่องเดิมที่ชำรุด" />
          </label>
          <label className="block text-sm font-medium">ชื่อเจ้าหน้าที่ IT *
            <input required maxLength={200} value={itStaffName} onChange={(e) => setItStaffName(e.target.value)} className={inputClass} placeholder="กรอกชื่อผู้จัดทำเอกสาร" />
          </label>
          <p className="text-sm text-amber-800">ตรวจข้อมูลก่อนบันทึก ใบที่บันทึกแล้วเก็บเป็นเอกสารย้อนหลังและพิมพ์ซ้ำได้ ไม่มีการอนุมัติหรือลงลายเซ็นออนไลน์</p>
          <button type="submit" className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? 'กำลังบันทึก…' : initialRequest ? 'บันทึกการแก้ไขและเปิดเอกสาร' : 'บันทึกและเปิดใบสำหรับพิมพ์'}
          </button>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </form>
    </section>
  );
}
