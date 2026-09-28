"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass, stockLabel, todayBangkok } from "./accessory-ui";

const titles = { receive:"รับ Accessories เข้าคลังกลาง",issue:"เบิก Accessories ให้พนักงาน",editStock:"แก้ไขข้อมูล Stock",disposeStock:"ตัดออกจากคลังกลาง",edit:"แก้ไขรายการที่ถืออยู่",return:"คืน Accessories เข้าคลัง",transfer:"โอน Accessories ให้พนักงานอื่น",dispose:"ตัดออกจากรายการที่พนักงานถืออยู่" };

function Field({ label, children, hint }) {
  return <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}</label>;
}

// A retry with unchanged input reuses its request ID, including after a network
// failure. The server commits balances and the audit record in one transaction.
export default function AccessoryActionForm({ mode, stock, holding, userId, stocks, types, users, onSuccess, onCancel }) {
  const [form,setForm] = useState(()=>({
    stock_item_id:String(stock?.id || holding?.stock_item_id || ""),
    accessory_type_id:String(stock?.accessory_type_id || ""),
    brand:stock?.brand || "",model:stock?.model || "",serial_number:stock?.serial_number || "",
    quantity:String(["return","transfer","dispose","edit"].includes(mode) ? holding?.remaining_quantity || 1 : 1),
    issued_date:holding?.issued_date || todayBangkok(),event_date:todayBangkok(),
    to_user_id:"",notes:mode==="edit" ? holding?.notes || "" : "",
    reason:mode==="return" ? "คืนเข้าคลัง" : mode==="transfer" ? "โอนให้พนักงานอื่น" : "",
    disposal_reason:"เสีย",disposal_detail:"",
  }));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const retry = useRef(null);
  const submitting = useRef(false);
  const selectedStock = stocks.find(s=>s.id===form.stock_item_id) || stock;
  const processed = holding ? holding.returned_quantity+holding.transferred_quantity+holding.disposed_quantity : 0;
  const isDisposal = mode==="dispose" || mode==="disposeStock";
  const metadata = mode==="editStock" || (mode==="receive" && !form.stock_item_id);
  const hasQuantity = mode!=="editStock";
  const maxQuantity = selectedStock?.serial_number ? 1 : mode==="issue" || mode==="disposeStock" ? selectedStock?.available_quantity || 100000 : ["return","transfer","dispose"].includes(mode) ? holding.remaining_quantity : mode==="edit" ? (selectedStock?.available_quantity || 0)+(selectedStock?.id===holding.stock_item_id ? holding.remaining_quantity : 0) : 100000;
  function change(event) {
    const {name,value}=event.target;
    setForm(previous=>({...previous,[name]:value,...(name==="stock_item_id" ? {quantity:"1"} : {})}));
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current=true; setBusy(true); setError("");
    let saved=false;
    try {
      let url="/api/accessories",method="POST";
      const body={...form};
      if (isDisposal) body.reason=[form.disposal_reason,form.disposal_detail.trim()].filter(Boolean).join(": ");
      if (mode==="issue") {
        const employeeId=userId || form.to_user_id;
        if (!employeeId) throw new Error("กรุณาเลือกพนักงาน");
        url=`/api/users/${employeeId}/accessories`;
      } else if (mode==="editStock" || mode==="disposeStock") {
        url=`/api/accessories/${stock.id}${mode==="disposeStock"?"/dispose":""}`;
        method=mode==="editStock" ? "PATCH" : "POST";
        body.expected_version=stock.version;
      } else if (holding) {
        url=`/api/users/${userId}/accessories/${holding.id}${mode==="edit"?"":`/${mode}`}`;
        method=mode==="edit" || mode==="return" ? "PATCH" : "POST";
        body.expected_version=holding.version;
      }
      const fingerprint=JSON.stringify({url,method,body});
      if (retry.current?.fingerprint!==fingerprint) retry.current={fingerprint,key:crypto.randomUUID()};
      body.request_id=retry.current.key;
      await accessoryFetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      saved=true;
      await onSuccess();
    } catch(error) { setError(`${saved?"บันทึกสำเร็จ แต่โหลดข้อมูลล่าสุดไม่ได้: ":""}${error.message}`); }
    finally { submitting.current=false; setBusy(false); }
  }
  const selectableStocks = stocks.filter(s=>(s.is_active && s.available_quantity>0) || (mode==="receive" && s.is_active) || s.id===holding?.stock_item_id);
  return (
    <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-slate-900">{titles[mode]}</h3>
      {(stock || holding) && <p className="mt-1 text-sm text-slate-600">{stockLabel(stock || holding)}</p>}
      {mode==="edit" && <p className="mt-2 text-sm text-blue-800">จำนวนที่แก้คือจำนวนที่ถืออยู่ตอนนี้ ส่วนต่างจะเพิ่มหรือลด Stock อัตโนมัติ</p>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
        {(["receive","issue","edit"].includes(mode)) && <Field label="รายการ Stock" hint={mode==="edit" && processed>0 ? "มีประวัติแล้ว เปลี่ยนรายการได้โดยคืนส่วนที่เหลือและเบิกใหม่" : selectedStock ? `พร้อมเบิก ${selectedStock.available_quantity} ชิ้น` : undefined}>
          <select name="stock_item_id" value={form.stock_item_id} onChange={change} className={inputClass} required={mode!=="receive"} disabled={mode==="edit" && processed>0}>
            <option value="">{mode==="receive" ? "+ รายการใหม่" : "เลือกรายการ Stock"}</option>
            {selectableStocks.map(s=><option key={s.id} value={s.id}>{stockLabel(s)} · คลัง {s.available_quantity}</option>)}
          </select>
        </Field>}
        {metadata && <>
          <Field label="ประเภท *"><select name="accessory_type_id" value={form.accessory_type_id} onChange={change} className={inputClass} required><option value="">เลือกประเภท</option>{types.filter(t=>t.is_active || t.id===form.accessory_type_id).map(t=><option key={t.id} value={t.id}>{t.name}{!t.is_active?" (Inactive)":""}</option>)}</select></Field>
          <Field label="ยี่ห้อ"><input name="brand" value={form.brand} onChange={change} maxLength={150} className={inputClass} /></Field>
          <Field label="รุ่น"><input name="model" value={form.model} onChange={change} maxLength={150} className={inputClass} /></Field>
          <Field label="Serial Number" hint="ถ้ามี Serial ใช้ 1 ชิ้นต่อรายการ"><input name="serial_number" value={form.serial_number} onChange={change} maxLength={200} className={inputClass} /></Field>
          {!types.some(t=>t.is_active) && <p className="text-sm text-amber-800">เพิ่มประเภทใน <Link href="/master/accessory_types" className="underline">Master Data</Link> ก่อนรับเข้า</p>}
        </>}
        {(mode==="transfer" || (mode==="issue" && !userId)) && <Field label={mode==="transfer"?"พนักงานผู้รับโอน *":"พนักงานผู้รับ *"}><select name="to_user_id" value={form.to_user_id} onChange={change} className={inputClass} required><option value="">เลือกพนักงาน</option>{users.filter(u=>u.id!==String(userId)).map(u=><option key={u.id} value={u.id}>{personLabel(u)}</option>)}</select></Field>}
        {hasQuantity && <Field label={mode==="edit" ? "จำนวนที่ถืออยู่หลังแก้ไข *" : "จำนวน *"} hint={["return","transfer","dispose"].includes(mode)?`ถืออยู่ ${holding.remaining_quantity} ชิ้น เลือกทำบางส่วนหรือทั้งหมดได้`:undefined}><input type="number" name="quantity" min="1" max={metadata && form.serial_number ? 1 : Math.min(100000,maxQuantity)} step="1" value={form.quantity} onChange={change} required className={inputClass} /></Field>}
        {(mode==="issue" || mode==="edit") && <Field label="วันที่เบิก *"><input type="date" name="issued_date" value={form.issued_date} onChange={change} max={todayBangkok()} required className={inputClass} /></Field>}
        {mode!=="issue" && <Field label={mode==="edit"?"วันที่แก้ไข *":"วันที่ดำเนินการ *"}><input type="date" name="event_date" value={form.event_date} onChange={change} min={holding?.issued_date} max={todayBangkok()} required className={inputClass} /></Field>}
        {isDisposal ? <>
          <Field label="เหตุผลตัดออก *"><select name="disposal_reason" value={form.disposal_reason} onChange={change} className={inputClass}>{["เสีย","สูญหาย","หมดอายุ/เสื่อมสภาพ","อื่นๆ"].map(value=><option key={value}>{value}</option>)}</select></Field>
          <Field label={form.disposal_reason==="อื่นๆ"?"รายละเอียดเหตุผล *":"รายละเอียดเหตุผล"}><input name="disposal_detail" value={form.disposal_detail} onChange={change} maxLength={450} required={form.disposal_reason==="อื่นๆ"} className={inputClass} /></Field>
        </> : mode!=="issue" && <Field label={mode==="receive" ? "ที่มา / เหตุผลรับเข้า *" : "เหตุผล *"}><input name="reason" value={form.reason} onChange={change} maxLength={500} required className={inputClass} placeholder={mode==="receive"?"เช่น ซื้อเข้า / พบจากตรวจนับ":""} /></Field>}
        {mode!=="editStock" && <div className="sm:col-span-2"><Field label="หมายเหตุ"><textarea name="notes" value={form.notes} onChange={change} maxLength={10000} rows={2} className={inputClass} /></Field></div>}
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className={isDisposal?"min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50":primaryClass}>{busy?"กำลังบันทึก…":isDisposal?"ยืนยันตัดออก":"บันทึก"}</button><button type="button" className={buttonClass} onClick={onCancel}>ยกเลิก</button></div>
      </fieldset>
    </form>
  );
}
