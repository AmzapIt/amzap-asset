"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessoryActionForm from "@/app/accessories/AccessoryActionForm";
import AccessoryHistory from "@/app/accessories/AccessoryHistory";
import { accessoryFetch, actionLabels, buttonClass, formatDate, primaryClass, stockLabel } from "@/app/accessories/accessory-ui";

export default function AccessorySection({ userId, canWrite }) {
  const router=useRouter();
  const [data,setData]=useState(null);
  const [inventory,setInventory]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [action,setAction]=useState(null);
  const [revision,setRevision]=useState(0);
  const panel=useRef(null);
  const load=useCallback(async(signal)=>{
    const [employee,warehouse]=await Promise.all([
      accessoryFetch(`/api/users/${userId}/accessories`,{signal}),
      accessoryFetch("/api/accessories",{signal}),
    ]);
    setData(employee);setInventory(warehouse);setRevision(v=>v+1);
  },[userId]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setLoading(true);setError("");
      load(controller.signal).catch(error=>{if (!controller.signal.aborted) setError(error.message);}).finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    },0);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[load]);
  async function reload() {
    setLoading(true);setError("");
    try { await load();setAction(null);router.refresh(); }
    catch(error) { setError(error.message); }
    finally { setLoading(false); }
  }
  function start(mode,holding) {
    setAction({mode,holding});setMessage("");setError("");
    requestAnimationFrame(()=>panel.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  const current=data?.accessories.filter(row=>row.remaining_quantity>0) || [];
  const closed=data?.accessories.filter(row=>row.remaining_quantity===0) || [];
  const ready=inventory?.stocks.some(s=>s.is_active && s.available_quantity>0);
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Accessories</h2><p className="mt-1 text-sm text-slate-500">อุปกรณ์ที่พนักงานถืออยู่ · เบิกจากคลังกลางทั้งบริษัท</p></div><div className="flex flex-wrap gap-2"><Link href="/accessories" className={buttonClass}>ดู Stock กลาง</Link><button className={buttonClass} onClick={reload} disabled={loading}>โหลดล่าสุด</button>{canWrite && <button onClick={()=>start("issue")} disabled={loading || !ready || !data?.employee?.is_active} className={primaryClass}>+ เบิก Accessories</button>}</div></div>
    {loading && <p role="status" className="text-sm text-slate-500">กำลังโหลด Accessories…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {!loading && data?.employee && !data.employee.is_active && canWrite && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">พนักงาน Inactive รับเบิกใหม่ไม่ได้ สามารถคืน โอนออก หรือตัดออกจากรายการเดิมได้</p>}
    {!loading && data && !ready && canWrite && data.employee?.is_active && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">ยังไม่มี Stock พร้อมเบิก <Link className="text-blue-700 underline" href="/accessories">บันทึกรับเข้าที่คลังกลาง</Link> ก่อน</p>}
    <div ref={panel} className="scroll-mt-20">{action && inventory && <AccessoryActionForm key={`${action.mode}-${action.holding?.id || "new"}`} {...action} userId={String(userId)} stocks={inventory.stocks} types={inventory.types} users={inventory.users} onCancel={()=>setAction(null)} onSuccess={async()=>{await load();setAction(null);setMessage("บันทึกสำเร็จ อัปเดตรายการที่ถืออยู่และยอด Stock แล้ว");router.refresh();}} />}</div>
    {!loading && data && !current.length && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">ไม่มี Accessories ที่กำลังถืออยู่</p>}
    <div className="space-y-3">{current.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{stockLabel(row)}</h3><p className="mt-1 text-xs text-slate-500">เบิก {formatDate(row.issued_date)} · รายการ #{row.id}</p></div><span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">ถืออยู่ {row.remaining_quantity} ชิ้น</span></div><p className="mt-2 text-xs text-slate-500">คืนแล้ว {row.returned_quantity} · โอนออก {row.transferred_quantity} · ตัดออก {row.disposed_quantity}</p>{row.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{row.notes}</p>}{canWrite && <div className="mt-3 flex flex-wrap gap-2">{["edit","transfer","return","dispose"].map(mode=><button key={mode} className={`${buttonClass} ${mode==="dispose"?"text-red-700":""}`} onClick={()=>start(mode,row)} disabled={loading}>{mode==="return"?"คืนบางส่วน / ทั้งหมด":mode==="transfer"?"โอนบางส่วน / ทั้งหมด":actionLabels[mode]}</button>)}</div>}</article>)}</div>
    {data && <>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">รายการที่ปิดแล้ว ({closed.length})</summary><div className="mt-3 space-y-3">{closed.length===0?<p className="text-sm text-slate-500">ยังไม่มีรายการที่ปิด</p>:closed.map(row=><article key={row.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="break-words font-semibold">{stockLabel(row)}</p><p className="mt-1 text-xs text-slate-500">เบิก {formatDate(row.issued_date)} · ปิด {formatDate(row.returned_date)} ({actionLabels[row.close_reason] || "คืน"})</p><p className="mt-2 text-slate-600">คืน {row.returned_quantity} · โอน {row.transferred_quantity} · ตัดออก {row.disposed_quantity} ชิ้น</p>{row.notes && <p className="mt-1 whitespace-pre-wrap break-words text-slate-500">{row.notes}</p>}</article>)}</div></details>
      <AccessoryHistory key={`employee-history-${revision}`} initialMovements={data.movements} initialHasMore={data.hasMore} userId={String(userId)} />
    </>}
  </section>;
}
