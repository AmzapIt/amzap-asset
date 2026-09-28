"use client";

import { useState } from "react";
import { accessoryFetch, actionLabels, buttonClass, formatDate, stockLabel } from "./accessory-ui";

export default function AccessoryHistory({ initialMovements, initialHasMore, userId, stockId }) {
  const [rows,setRows]=useState(initialMovements);
  const [hasMore,setHasMore]=useState(initialHasMore);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function more() {
    if (loading || !rows.length) return;
    setLoading(true);setError("");
    try {
      const params=new URLSearchParams({before:rows.at(-1).id});
      if (userId) params.set("user_id",userId);
      if (stockId) params.set("stock_id",stockId);
      const data=await accessoryFetch(`/api/accessories/movements?${params}`);
      setRows(previous=>[...previous,...data.movements]);setHasMore(data.hasMore);
    } catch(error) { setError(error.message); }
    finally { setLoading(false); }
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4 sm:p-5"><h2 className="text-lg font-semibold">ประวัติ Accessories</h2><p className="mt-1 text-sm text-slate-500">เรียงตามเวลาที่บันทึกล่าสุด · เก็บผู้ดำเนินการและเหตุผลทุกครั้ง</p></div>
      {!rows.length ? <p className="p-5 text-sm text-slate-500">ยังไม่มีประวัติ</p> : <ol className="divide-y divide-slate-100">{rows.map(row=><li key={row.id} className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.action==="dispose"?"bg-red-50 text-red-700":"bg-blue-50 text-blue-700"}`}>{actionLabels[row.action] || row.action}</span><span className="text-sm font-semibold">{row.quantity.toLocaleString("th-TH")} ชิ้น</span><span className="text-xs text-slate-500">{formatDate(row.event_date)}</span></div><span className="text-xs text-slate-500">คลัง {row.stock_delta>0?"+":""}{row.stock_delta} → คงเหลือ {row.balance_after}</span></div>
        <p className="mt-2 break-words text-sm font-medium text-slate-800">{stockLabel(row)}</p>
        {(row.from_name || row.to_name) && <p className="mt-1 text-sm text-slate-600">{row.from_name && `จาก ${row.from_name}${row.from_nickname?` (${row.from_nickname})`:""}`}{row.from_name && row.to_name && " → "}{row.to_name && `ถึง ${row.to_name}${row.to_nickname?` (${row.to_nickname})`:""}`}</p>}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{row.reason}{row.notes?` · ${row.notes}`:""}</p>
        {row.action==="edit" && row.details?.before && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">ข้อมูลก่อนและหลังแก้ไข</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{["before","after"].map(side=><div key={side}><p className="font-semibold">{side==="before"?"ก่อนแก้ไข":"หลังแก้ไข"}</p><dl className="mt-1 space-y-1">{Object.entries(row.details[side] || {}).map(([key,value])=><div key={key} className="flex flex-wrap gap-1"><dt>{({stock_item_id:"Stock ID",quantity:"จำนวนที่ถือ",issued_date:"วันที่เบิก",notes:"หมายเหตุ",brand:"ยี่ห้อ",model:"รุ่น",serial_number:"Serial",accessory_type_id:"ประเภท ID",available_quantity:"ในคลัง",version:"เวอร์ชัน",id:"Stock ID"})[key] || key}:</dt><dd className="break-words">{String(value??"–")}</dd></div>)}</dl></div>)}</div></details>}
        <p className="mt-2 text-xs text-slate-400">{row.actor_name || "นำเข้าข้อมูลเดิม"} · บันทึก {new Date(row.created_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})} · #{row.id}</p>
      </li>)}</ol>}
      {error && <p role="alert" className="px-5 py-3 text-sm text-red-700">{error}</p>}
      {hasMore && <div className="border-t border-slate-100 p-4"><button onClick={more} disabled={loading} className={buttonClass}>{loading?"กำลังโหลด…":"โหลดประวัติเก่าเพิ่ม"}</button></div>}
    </section>
  );
}
