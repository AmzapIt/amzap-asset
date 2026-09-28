"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessoryActionForm from "./AccessoryActionForm";
import AccessoryHistory from "./AccessoryHistory";
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass } from "./accessory-ui";

export default function StockManager({ initialInventory, canWrite }) {
  const router=useRouter();
  const [data,setData]=useState(initialInventory);
  const [search,setSearch]=useState("");
  const [type,setType]=useState("");
  const [action,setAction]=useState(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [revision,setRevision]=useState(0);
  const [historyStock,setHistoryStock]=useState("");
  const [history,setHistory]=useState({movements:initialInventory.movements,hasMore:initialInventory.hasMore});
  const formPanel=useRef(null);
  const historyPanel=useRef(null);
  function start(mode,stock) {
    setAction({mode,stock});setMessage("");setError("");
    requestAnimationFrame(()=>formPanel.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  async function refresh() {
    const fresh=await accessoryFetch("/api/accessories");
    setData(fresh);setHistoryStock("");setHistory({movements:fresh.movements,hasMore:fresh.hasMore});setRevision(v=>v+1);
    router.refresh();
  }
  async function reload() {
    setLoading(true);setError("");
    try { await refresh();setAction(null); }
    catch(error) { setError(error.message); }
    finally { setLoading(false); }
  }
  async function filterHistory(stockId) {
    setLoading(true);setError("");
    try {
      const fresh=await accessoryFetch(`/api/accessories/movements${stockId?`?stock_id=${stockId}`:""}`);
      setHistoryStock(stockId);setHistory(fresh);setRevision(v=>v+1);
      requestAnimationFrame(()=>historyPanel.current?.scrollIntoView({behavior:"smooth",block:"start"}));
    } catch(error) { setError(error.message); }
    finally { setLoading(false); }
  }
  const term=search.trim().toLocaleLowerCase();
  const stocks=data.stocks.filter(s=>(!type || s.accessory_type_id===type) && (!term || [s.accessory_type,s.brand,s.model,s.serial_number].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)));
  const cards=[["พร้อมเบิกในคลัง",data.summary.available,"text-blue-700"],["พนักงานถืออยู่",data.summary.held,"text-violet-700"],["คงเหลือทั้งบริษัท",data.summary.available+data.summary.held,"text-emerald-700"],["ตัดออกสะสม",data.summary.disposed,"text-red-700"]];
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm tracking-widest text-blue-200">AMZAP · คลังกลางทั้งบริษัท</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Accessories / Stock</h1><p className="mt-2 text-blue-100">รับเข้า เบิก โอน คืนบางส่วน และตัดออก พร้อมประวัติการเคลื่อนไหว</p></div>
      <div className="flex flex-wrap gap-2">{canWrite && <button className="min-h-11 rounded-lg bg-white px-4 py-2 font-semibold text-blue-900" onClick={()=>start("receive")}>+ รับเข้าคลัง</button>}<button className="min-h-11 rounded-lg border border-blue-300 px-4 py-2 text-sm disabled:opacity-50" onClick={reload} disabled={loading}>{loading?"กำลังโหลด…":"โหลดล่าสุด"}</button></div>
    </header>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(([label,value,color])=><section key={label} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-sm text-slate-500">{label}</h2><p className={`mt-3 text-3xl font-bold ${color}`}>{value.toLocaleString("th-TH")}</p></section>)}</div>
    <div ref={formPanel} className="scroll-mt-20">{action && <AccessoryActionForm key={`${action.mode}-${action.stock?.id || "new"}`} {...action} stocks={data.stocks} types={data.types} users={data.users} onCancel={()=>setAction(null)} onSuccess={async()=>{await refresh();setAction(null);setMessage("บันทึกสำเร็จ อัปเดตยอด Stock และประวัติแล้ว");}} />}</div>
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">รายการ Stock</h2><Link href="/users" className="text-sm font-medium text-blue-700 hover:underline">จัดการ Accessories ของพนักงาน →</Link></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-600">ค้นหาประเภท ยี่ห้อ รุ่น หรือ Serial<input className={`${inputClass} mt-1.5`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา Accessories…" /></label><label className="text-sm text-slate-600">ประเภท<select value={type} onChange={e=>setType(e.target.value)} className={`${inputClass} mt-1.5`}><option value="">ทุกประเภท</option>{data.types.map(t=><option key={t.id} value={t.id}>{t.name}{!t.is_active?" (Inactive)":""}</option>)}</select></label></div></div>
      {!stocks.length ? <div className="p-8 text-center text-slate-500"><p>{data.stocks.length?"ไม่พบรายการที่ค้นหา":"ยังไม่มีรายการ Stock"}</p>{canWrite && !data.stocks.length && <button onClick={()=>start("receive")} className={`${primaryClass} mt-4`}>รับเข้ารายการแรก</button>}</div> : <div className="divide-y divide-slate-100">{stocks.map(s=><article key={s.id} className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap gap-2"><h3 className="font-semibold">{s.accessory_type}</h3>{!s.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}</div><p className="mt-1 break-words text-sm text-slate-600">{[s.brand,s.model].filter(Boolean).join(" · ") || "ไม่ระบุยี่ห้อ/รุ่น"}</p>{s.serial_number && <p className="mt-1 break-all text-xs text-slate-500">Serial: {s.serial_number}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{canWrite && <><button className={buttonClass} onClick={()=>start("receive",s)} disabled={!s.is_active}>รับเข้า</button><button className={primaryClass} onClick={()=>start("issue",s)} disabled={!s.is_active || !s.available_quantity}>เบิกให้พนักงาน</button><button className={buttonClass} onClick={()=>start("editStock",s)}>แก้ไข</button><button className={`${buttonClass} text-red-700`} onClick={()=>start("disposeStock",s)} disabled={!s.available_quantity}>ตัดออกจากคลัง</button></>}<button className={buttonClass} onClick={()=>filterHistory(s.id)} disabled={loading}>ประวัติ</button></div>
        </div><dl className="grid grid-cols-3 gap-2 self-start text-center"><div className="rounded-xl bg-blue-50 px-4 py-3"><dt className="text-xs text-blue-700">ในคลัง</dt><dd className="mt-1 text-xl font-bold text-blue-800">{s.available_quantity}</dd></div><div className="rounded-xl bg-violet-50 px-4 py-3"><dt className="text-xs text-violet-700">ถืออยู่</dt><dd className="mt-1 text-xl font-bold text-violet-800">{s.held_quantity}</dd></div><div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">ตัดออก</dt><dd className="mt-1 text-xl font-bold text-slate-700">{s.disposed_quantity}</dd></div></dl></div>
        {s.held_quantity>0 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-slate-600">พนักงานที่ถืออยู่ ({s.holders} คน)</summary><ul className="mt-3 space-y-2">{data.holdings.filter(h=>h.stock_item_id===s.id).map(h=><li key={h.user_id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><Link href={`/users/${h.user_id}`} className="text-blue-700 hover:underline">{personLabel(h)}</Link><span>{h.quantity} ชิ้น</span></li>)}</ul></details>}
      </article>)}</div>}
    </section>
    <p className="text-xs leading-relaxed text-slate-500">ยอดเปิดรวมอุปกรณ์ที่พนักงานถืออยู่ก่อนเริ่มระบบ Stock ส่วนของในคลังเดิมให้ตรวจนับและบันทึกรับเข้า ยอดคงเหลือทั้งบริษัท = ในคลัง + พนักงานถืออยู่</p>
    <div ref={historyPanel} className="flex scroll-mt-20 flex-wrap items-center gap-3"><label className="text-sm text-slate-600" htmlFor="history-stock">ประวัติของ</label><select id="history-stock" className={`${inputClass} sm:max-w-lg`} value={historyStock} onChange={e=>filterHistory(e.target.value)} disabled={loading}><option value="">ทุกรายการ</option>{data.stocks.map(s=><option key={s.id} value={s.id}>{[s.accessory_type,s.brand,s.model,s.serial_number].filter(Boolean).join(" · ")}</option>)}</select></div>
    <AccessoryHistory key={`history-${revision}`} initialMovements={history.movements} initialHasMore={history.hasMore} stockId={historyStock} />
  </div>;
}
