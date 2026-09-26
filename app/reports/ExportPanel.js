"use client";
import {useState} from "react";
import {formatUserDisplayName} from "@/lib/user-display";
/**
 * ฝั่ง browser รับข้อมูลเริ่มต้นจาก ReportsPage แล้วค้นหา/กรองโดยไม่แก้ฐานข้อมูล
 * selected เก็บเฉพาะ Asset ID; recipient คือพนักงานที่จะระบุในใบรับมอบ
 * form เก็บข้อมูลเอกสารชั่วคราว ส่วน busy/error ใช้แสดงสถานะการดาวน์โหลด
 */
export default function ExportPanel({assets,users}){
  const [search,setSearch]=useState("");const [selected,setSelected]=useState([]);const [recipient,setRecipient]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [form,setForm]=useState({kind:"พนักงานใหม่"});
  const [status,setStatus]=useState("");
  // ใช้สถานะที่พบในข้อมูลจริง และกรองร่วมกับข้อความค้นหา (ต้องตรงทั้งสองเงื่อนไข)
  const statuses=[...new Set(assets.map(asset=>asset.status).filter(Boolean))].sort();
  // กรองสถานะและข้อความร่วมกัน; ค่าว่างของสถานะหมายถึงทุกสถานะ
  // ค้นหาได้ทั้ง Asset Owner และผู้ครอบครองปัจจุบันตามกติกากลางของระบบ
  const rows=assets.filter(a=>(!status || a.status===status) && [a.asset_code,a.legacy_asset_codes,a.asset_name,a.serial_number,a.owner_name,a.current_holder].some(v=>String(v??"").toLowerCase().includes(search.toLowerCase().trim())));
  // ส่ง ID ที่เลือกให้ API อ่านข้อมูลจริงอีกครั้ง ไม่ส่งชื่อ/Serial จาก browser ไปเป็นข้อมูลหลัก
  // เมื่อสำเร็จแปลง Blob เป็น URL ชั่วคราวเพื่อดาวน์โหลด แล้วคืนหน่วยความจำด้วย revokeObjectURL
  // finally คืนสถานะ busy เสมอ ทั้งกรณีสำเร็จและผิดพลาด เพื่อให้ผู้ใช้ลองใหม่ได้
  async function download(format){setBusy(true);setError("");try{const response=await fetch("/api/reports/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({format,ids:selected,recipientId:recipient,form})});if(!response.ok){const data=await response.json();throw new Error(data.error);}const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=`AMZAP-${format}.${format==="xlsx"?"xlsx":"pdf"}`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}finally{setBusy(false);}}
  // เปลี่ยนคำค้นหาหรือสถานะจะล้าง selected เพื่อไม่ส่งออกรายการที่ซ่อนจากตาราง
  // ปุ่มเลือกทั้งหมดใช้ rows ที่กรองแล้ว; ใบรับมอบต้องเลือกพนักงานและ Asset 1–7 รายการ
  // ข้อจำกัดที่ปุ่มเป็นเพียงการช่วยผู้ใช้ API จะตรวจซ้ำทุกครั้งก่อนสร้างเอกสาร
  return <div className="space-y-6"><section className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"><h2 className="font-semibold">1. เลือกทรัพย์สิน ({selected.length} รายการ)</h2><input aria-label="ค้นหาทรัพย์สิน" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);}} placeholder="ค้นหารหัส ชื่อ Serial หรือผู้ครอบครอง"/>{/* ล้างรายการที่เลือกเมื่อเปลี่ยนตัวกรอง ป้องกันส่งออก Asset ที่ถูกซ่อน */}
  <label className="block text-sm font-medium">สถานะ
    <select className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-500 md:max-w-xs" value={status} onChange={e=>{setStatus(e.target.value);setSelected([]);}}>
      <option value="">ทุกสถานะ</option>
      {statuses.map(value=><option key={value} value={value}>{value}</option>)}
    </select>
  </label>
  <p className="text-sm text-gray-500">พบ {rows.length} รายการ · เปลี่ยนคำค้นหาหรือสถานะจะล้างรายการที่เลือก</p>
  <div className="flex gap-4"><button className="underline" onClick={()=>setSelected(rows.map(a=>a.id))}>เลือกผลค้นหาทั้งหมด ({rows.length})</button><button className="underline" onClick={()=>setSelected([])}>ล้างการเลือก</button></div><div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>เลือก</th><th>Asset Code</th><th>ชื่อทรัพย์สิน</th><th>สถานะ</th><th>ผู้ครอบครองปัจจุบัน</th></tr></thead><tbody>{rows.map(a=><tr key={a.id} className="border-b"><td className="p-2"><input type="checkbox" aria-label={`เลือก ${a.asset_code}`} checked={selected.includes(a.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id))}/></td><td>{a.asset_code}{a.legacy_asset_codes&&<span className="block text-xs text-amber-700">เดิม: {a.legacy_asset_codes}</span>}</td><td>{a.asset_name}</td><td>{a.status}</td><td>{a.current_holder||"-"}</td></tr>)}</tbody></table>{!rows.length&&<p className="py-4">ไม่พบรายการ</p>}</div><div className="flex flex-wrap gap-3"><button disabled={busy||!selected.length} className="rounded bg-emerald-700 p-3 text-white disabled:opacity-40" onClick={()=>download("xlsx")}>Export Excel</button><button disabled={busy||!selected.length} className="rounded bg-blue-700 p-3 text-white disabled:opacity-40" onClick={()=>download("pdf")}>Export PDF รายการ Asset</button></div></section>
  <section className="rounded-xl border bg-white p-5 space-y-4"><h2 className="font-semibold">2. ใบรับมอบทรัพย์สินตามแบบ AMZAP</h2><p className="text-sm text-gray-600">เลือกได้สูงสุด 7 อุปกรณ์ต่อใบ · การออกเอกสารยังไม่เปลี่ยนผู้รับมอบหมายในระบบ · เว้นลายเซ็นสำหรับลงนามจริง</p><label className="block">ผู้รับมอบ<select className="mt-1 block w-full rounded border p-3" value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">เลือกพนักงาน</option>{users.map(u=><option key={u.id} value={u.id}>{u.employee_code} — {formatUserDisplayName(u)}{u.status===0?" (Inactive)":""}</option>)}</select></label><label className="block">ประเภทการรับมอบ<select className="mt-1 block w-full rounded border p-3" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}>{["พนักงานใหม่","เปลี่ยนอุปกรณ์","รับเพิ่ม","คืนอุปกรณ์"].map(v=><option key={v}>{v}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2">{[["documentNo","เลขที่เอกสาร",60],["date","วันที่ส่งมอบ",10],["location","สถานที่ส่งมอบ",100],["purpose","วัตถุประสงค์การใช้งาน",150],["startDate","วันที่เริ่มครอบครอง",10],["notes","หมายเหตุ / ตำหนิอุปกรณ์",350],["deliveredBy","ผู้ส่งมอบ / ฝ่าย IT",100],["approvedBy","ผู้อนุมัติ",100],["itNotes","หมายเหตุฝ่าย IT",350]].map(([key,label,max])=><label key={key}>{label}<input className="mt-1 block w-full rounded border p-3" type={key==="date"||key==="startDate"?"date":"text"} maxLength={max} value={form[key]??""} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}</div><button disabled={busy||!recipient||!selected.length||selected.length>7} className="rounded bg-slate-900 p-3 text-white disabled:opacity-40" onClick={()=>download("handover")}>ดาวน์โหลด PDF ใบรับมอบ</button></section><p role="status" className="text-red-700">{busy?"กำลังสร้างเอกสาร…":error}</p></div>;
}
