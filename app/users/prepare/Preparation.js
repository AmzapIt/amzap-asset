"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EmployeePicker from "@/app/components/EmployeePicker";
import { buildAssetCodePreview } from "@/lib/asset-code";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const button = "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50";
const primary = "rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50";
const emptyUser = { employee_code:"", full_name:"", full_name_en:"", nickname:"", nickname_en:"", email:"", position:"", department_id:"", location_id:"", is_active:"true" };
const emptyAsset = { registrationSiteId:"", type:"", assetCodeNumber:"", assetName:"", brand:"", model:"", serialNumber:"", computerName:"", operatingSystem:"", cpu:"", ramGb:"", storageGb:"" };
const stockName = (s) => [s.accessory_type,s.brand,s.model,s.serial_number].filter(Boolean).join(" · ");

async function request(url, body) {
  let response;
  try { response = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }); }
  catch { throw new Error("ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจข้อมูลในระบบก่อนทำรายการซ้ำ"); }
  let data;
  try { data = await response.json(); } catch { throw new Error("ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจข้อมูลในระบบก่อนทำรายการซ้ำ"); }
  if (response.status >= 500) throw new Error("ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจข้อมูลในระบบก่อนทำรายการซ้ำ");
  if (!response.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
  return data;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} className={button}>ปิด</button></div>{children}</section></div>;
}

export default function Preparation({ data }) {
  const [users,setUsers]=useState(data.users);
  const [assets,setAssets]=useState(data.assets);
  const [userId,setUserId]=useState("");
  const [locationId,setLocationId]=useState("");
  const [selected,setSelected]=useState([]);
  const [accessories,setAccessories]=useState([]);
  const [stockId,setStockId]=useState("");
  const [quantity,setQuantity]=useState("1");
  const [modal,setModal]=useState("");
  const [userForm,setUserForm]=useState(emptyUser);
  const [assetForm,setAssetForm]=useState(emptyAsset);
  const [latest,setLatest]=useState("");
  const [date,setDate]=useState(data.today);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [locked,setLocked]=useState(false);
  const employee=users.find((u)=>String(u.id)===userId);
  const type=data.types.find((t)=>t.name===assetForm.type);
  const site=data.sites.find((s)=>s.id===assetForm.registrationSiteId);
  const stock=data.stocks.find((s)=>s.id===stockId);

  useEffect(() => {
    if (!assetForm.registrationSiteId || !type?.id) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ registrationSiteId:assetForm.registrationSiteId, assetTypeId:type.id });
    fetch(`/api/assets/latest-code?${params}`,{signal:controller.signal}).then(r=>r.json()).then(d=>setLatest(d.latestNumber || "ยังไม่มี")).catch(()=>{});
    return () => controller.abort();
  }, [assetForm.registrationSiteId,type?.id]);

  function selectEmployee(id) {
    setUserId(id);
    const user=users.find((u)=>String(u.id)===id);
    setLocationId(data.locations.some((l)=>l.id===String(user?.location_id)) ? String(user.location_id) : "");
  }
  async function addUser(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result=await request("/api/users",userForm); const user={...result.user,id:String(result.user.id),location_id:userForm.location_id,location_name:data.locations.find(l=>l.id===userForm.location_id)?.name}; setUsers(old=>[...old,user]); setUserId(user.id); setLocationId(userForm.location_id); setModal(""); setUserForm(emptyUser); }
    catch(e){setError(e.message); if(e.message.includes("ไม่สามารถยืนยันผล")) setLocked(true);} finally{setBusy(false);}
  }
  async function addAsset(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result=await request("/api/assets",assetForm); const asset={...result.asset,id:String(result.asset.id),type:assetForm.type,brand:assetForm.brand,model:assetForm.model,serial_number:assetForm.serialNumber}; setAssets(old=>[...old,asset]); setSelected(old=>[...old,{...asset,done:false,created:true}]); setModal(""); setAssetForm(emptyAsset); setLatest(""); }
    catch(e){setError(e.message); if(e.message.includes("ไม่สามารถยืนยันผล")) setLocked(true);} finally{setBusy(false);}
  }
  function addStock() {
    if (!stock || !Number.isInteger(Number(quantity)) || Number(quantity)<1 || Number(quantity)>stock.available_quantity || (stock.serial_number && Number(quantity)!==1)) { setError("กรุณาเลือก Stock และระบุจำนวนที่มีในคลัง"); return; }
    if (accessories.some(a=>a.id===stock.id)) { setError("รายการนี้ถูกเลือกแล้ว กรุณาลบรายการเดิมก่อนเปลี่ยนจำนวน"); return; }
    setAccessories(old=>[...old,{...stock,quantity:Number(quantity),requestId:crypto.randomUUID(),done:false}]); setStockId("");setQuantity("1");setError("");
  }
  async function save() {
    if (!employee || (!selected.length && !accessories.length) || (selected.length && !locationId)) {setError("กรุณาเลือกพนักงาน รายการอุปกรณ์ และสถานที่ปลายทางของ Asset");return;}
    setBusy(true);setError("");
    try {
      for (const asset of selected.filter(a=>!a.done)) {
        await request(`/api/assets/${asset.id}/assignments`,{action:"assign",assignedTo:userId,locationId,date,expectedAssignmentId:null,assignmentNotes:"มอบอุปกรณ์จากหน้าเตรียมพนักงาน"});
        setSelected(old=>old.map(a=>a.id===asset.id?{...a,done:true}:a));
      }
      for (const accessory of accessories.filter(a=>!a.done)) {
        await request(`/api/users/${userId}/accessories`,{stock_item_id:accessory.id,quantity:accessory.quantity,issued_date:date,request_id:accessory.requestId});
        setAccessories(old=>old.map(a=>a.id===accessory.id?{...a,done:true}:a));
      }
      setSuccess(true);
    } catch(e) { setError(e.message); if (e.message.includes("ไม่สามารถยืนยันผล")) setLocked(true); }
    finally {setBusy(false);}
  }
  const savedCount=selected.filter(a=>a.done).length+accessories.filter(a=>a.done).length;
  const canEdit=!busy && !success && savedCount===0 && !locked;
  const labelIds=selected.filter(a=>a.done).map(a=>a.id).join(",");
  return <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900"><div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-6 text-white"><Link href="/users" className="text-sm text-blue-200 hover:underline">← User Management</Link><h1 className="mt-3 text-2xl font-bold">เตรียมอุปกรณ์พนักงาน</h1><p className="mt-2 text-blue-100">เลือกพนักงาน เตรียมเครื่องและ Accessories แล้วบันทึกการมอบในหน้าเดียว</p></header>
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">1. พนักงาน</h2><button className={button} onClick={()=>{setError("");setModal("user");}} disabled={!canEdit}>+ เพิ่มพนักงานใหม่</button></div><EmployeePicker label="เลือกพนักงาน" users={users} value={userId} onChange={selectEmployee} disabled={!canEdit} /><p className="text-sm text-slate-600">{employee ? `${employee.employee_code || "ไม่มีรหัส"} · ${employee.full_name}${employee.nickname ? ` (${employee.nickname})` : ""} · ${employee.location_name || "ไม่ระบุสถานที่"}` : "เลือกพนักงานที่ Active หรือเพิ่มรายชื่อใหม่"}</p></section>
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">2. Asset</h2><p className="text-sm text-slate-500">เครื่องใหม่จะรับเข้าคลัง IT ก่อนมอบให้พนักงาน</p></div><button className={button} onClick={()=>{setError("");setModal("asset");}} disabled={!canEdit}>+ เพิ่มเครื่องใหม่</button></div><label className="block text-sm font-medium">เลือกเครื่องจากคลัง IT<select className={input} value="" disabled={!canEdit} onChange={e=>{const asset=assets.find(a=>a.id===e.target.value);if(asset&&!selected.some(a=>a.id===asset.id))setSelected(old=>[...old,{...asset,done:false,created:false}]);}}><option value="">เลือก Asset ที่พร้อมเบิก</option>{assets.filter(a=>!selected.some(s=>s.id===a.id)).map(a=><option key={a.id} value={a.id}>{a.asset_code} · {a.asset_name} {a.model||""}</option>)}</select></label>{selected.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span><strong>{a.asset_code}</strong> · {a.asset_name} {a.done ? "✓ มอบแล้ว" : a.created ? "· เพิ่มใหม่ในคลัง IT" : ""}</span>{canEdit&&<button onClick={()=>setSelected(old=>old.filter(x=>x.id!==a.id))} className="text-red-700">นำออก</button>}</div>)}{selected.length>0&&<label className="block text-sm font-medium">สถานที่ปลายทางของเครื่อง *<select value={locationId} onChange={e=>setLocationId(e.target.value)} disabled={!canEdit} className={input}><option value="">เลือกสถานที่</option>{data.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}</section>
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">3. Accessories <span className="text-sm font-normal text-slate-500">(ถ้ามี)</span></h2><div className="grid gap-3 sm:grid-cols-[1fr_100px_auto]"><select className={input} value={stockId} onChange={e=>setStockId(e.target.value)} disabled={!canEdit}><option value="">เลือกจาก Stock</option>{data.stocks.map(s=><option key={s.id} value={s.id}>{stockName(s)} · คงเหลือ {s.available_quantity}</option>)}</select><input aria-label="จำนวน Accessories" type="number" min="1" max={stock?.available_quantity||1} className={input} value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={!canEdit}/><button className={button} disabled={!canEdit} onClick={addStock}>เพิ่ม</button></div>{accessories.map(a=><div key={a.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span>{stockName(a)} · {a.quantity} ชิ้น {a.done&&"✓ เบิกแล้ว"}</span>{canEdit&&<button onClick={()=>setAccessories(old=>old.filter(x=>x.id!==a.id))} className="text-red-700">นำออก</button>}</div>)}</section>
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">4. ตรวจสอบและบันทึก</h2><p className="text-sm text-slate-600">{employee?.full_name || "ยังไม่ได้เลือกพนักงาน"} · Asset {selected.length} รายการ · Accessories {accessories.length} รายการ</p><label className="block max-w-xs text-sm font-medium">วันที่มอบ<input type="date" className={input} value={date} max={data.today} onChange={e=>setDate(e.target.value)} disabled={!canEdit} /></label>{savedCount>0&&!success&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">บันทึกไปแล้ว {savedCount} รายการ รายการที่สำเร็จจะไม่ถูกบันทึกซ้ำ</p>}{error&&!modal&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!success&&<button onClick={save} disabled={busy||locked||!userId||(!selected.length&&!accessories.length)||!date} className={primary}>{busy?"กำลังบันทึก...":savedCount?"บันทึกรายการที่เหลือ":"บันทึกและมอบอุปกรณ์"}</button>}{success&&<div className="space-y-3 rounded-xl bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">✓ บันทึกการมอบเรียบร้อย</p><div className="flex flex-wrap gap-2">{labelIds&&<Link href={`/labels?assetIds=${encodeURIComponent(labelIds)}`} className={primary}>พิมพ์ Asset Label</Link>}<Link href={`/reports/handover?userId=${userId}&assetIds=${encodeURIComponent(labelIds)}`} className={button}>พิมพ์ใบรับมอบ</Link><Link href={`/users/${userId}`} className={button}>ดูรายละเอียดพนักงาน</Link><button type="button" onClick={()=>window.location.reload()} className={button}>เริ่มรายการใหม่</button></div></div>}</section>
    {modal==="user"&&<Modal title="เพิ่มพนักงานใหม่" onClose={()=>!busy&&setModal("")}><form onSubmit={addUser} className="space-y-4"><p className="text-sm text-slate-500">บันทึกพนักงานทันที แล้วกลับมาเลือกอุปกรณ์ต่อ</p><div className="grid gap-3 sm:grid-cols-2">{[["employee_code","รหัสพนักงาน"],["full_name","ชื่อ–นามสกุล *"],["nickname","ชื่อเล่น"],["full_name_en","ชื่อภาษาอังกฤษ"],["nickname_en","ชื่อเล่นภาษาอังกฤษ"],["position","ตำแหน่ง"],["email","Email"]].map(([name,label])=><label key={name} className="text-sm font-medium">{label}<input className={input} name={name} type={name==="email"?"email":"text"} value={userForm[name]} required={name==="full_name"} onChange={e=>setUserForm(old=>({...old,[name]:e.target.value}))}/></label>)}<label className="text-sm font-medium">แผนก<select className={input} value={userForm.department_id} onChange={e=>setUserForm(old=>({...old,department_id:e.target.value}))}><option value="">ไม่ระบุ</option>{data.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="text-sm font-medium">สถานที่<select className={input} value={userForm.location_id} onChange={e=>setUserForm(old=>({...old,location_id:e.target.value}))}><option value="">ไม่ระบุ</option>{data.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button className={primary} disabled={busy||locked}>{busy?"กำลังบันทึก...":"บันทึกพนักงาน"}</button></form></Modal>}
    {modal==="asset"&&<Modal title="เพิ่มเครื่องใหม่เข้าคลัง IT" onClose={()=>!busy&&setModal("")}><form onSubmit={addAsset} className="space-y-4"><p className="text-sm text-slate-500">เมื่อบันทึก เครื่องจะเข้าคลัง IT ทันที และเพิ่มในรายการเตรียมมอบ</p><label className="block text-sm font-medium">คัดลอกข้อมูลจาก Asset เดิม (ถ้าต้องการ)<select className={input} defaultValue="" onChange={e=>{const a=data.templates.find(t=>t.id===e.target.value);if(a)setAssetForm(old=>({...old,type:a.type,assetName:a.asset_name||"",brand:a.brand||"",model:a.model||"",operatingSystem:a.operating_system||"",cpu:a.cpu||"",ramGb:a.ram_gb||"",storageGb:a.storage_gb||"",serialNumber:"",computerName:"",assetCodeNumber:""}));}}><option value="">เลือกเครื่องต้นแบบ</option>{data.templates.map(a=><option key={a.id} value={a.id}>{a.asset_code} · {a.asset_name} {a.model||""}</option>)}</select><span className="block text-xs text-slate-500">คัดลอกประเภท ชื่อ ยี่ห้อ รุ่น และสเปก โดยกรอกรหัสและ Serial ใหม่</span></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">สถานที่ขึ้นทะเบียน *<select className={input} value={assetForm.registrationSiteId} required onChange={e=>{setLatest("");setAssetForm(old=>({...old,registrationSiteId:e.target.value}));}}><option value="">เลือกสถานที่</option>{data.sites.map(s=><option key={s.id} value={s.id}>{s.site_code} — {s.name}</option>)}</select></label><label className="text-sm font-medium">ประเภท Asset *<select className={input} value={assetForm.type} required onChange={e=>{setLatest("");setAssetForm(old=>({...old,type:e.target.value}));}}><option value="">เลือกประเภท</option>{data.types.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></label><label className="text-sm font-medium">เลข Running 3 หลัก *<input className={input} inputMode="numeric" pattern="[0-9]{3}" maxLength="3" required value={assetForm.assetCodeNumber} onChange={e=>setAssetForm(old=>({...old,assetCodeNumber:e.target.value.replace(/\D/g,"")}))}/><span className="mt-1 block text-xs text-slate-500">รหัส: {buildAssetCodePreview(site?.site_code,type?.prefix,assetForm.assetCodeNumber)} · ล่าสุด: {latest||"เลือกสถานที่และประเภท"}</span></label>{[["assetName","ชื่อ Asset *"],["brand","ยี่ห้อ"],["model","รุ่น"],["serialNumber","Serial Number"],["computerName","Computer Name"],["operatingSystem","Operating System"],["cpu","CPU"],["ramGb","RAM (GB)"],["storageGb","Storage (GB)"]].map(([name,label])=><label key={name} className="text-sm font-medium">{label}<input className={input} value={assetForm[name]} required={name==="assetName"} onChange={e=>setAssetForm(old=>({...old,[name]:e.target.value}))}/></label>)}</div>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button className={primary} disabled={busy||locked}>{busy?"กำลังบันทึก...":"บันทึกเครื่องเข้าคลัง IT"}</button></form></Modal>}
  </div></main>;
}
