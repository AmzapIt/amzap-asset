"use client";

import { useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/client-api';

const kinds = { all:'ทั้งหมด',created:'สร้างข้อมูล',receipt:'รับเข้า / คืน',assignment:'เบิก',movement:'ย้าย',maintenance:'ซ่อมบำรุง',disposal:'จำหน่าย',photo:'รูป / เอกสาร',print:'พิมพ์ป้าย',audit:'แก้ไขข้อมูล / พร้อมเบิก',count:'ตรวจนับ' };
function date(value, dateOnly = false) {
  return new Intl.DateTimeFormat('th-TH',{ dateStyle:'medium',...(dateOnly ? {} : {timeStyle:'short'}),timeZone:'Asia/Bangkok' }).format(new Date(value));
}
export default function AssetHistory({ assetId }) {
  const [events,setEvents] = useState([]);
  const [cursor,setCursor] = useState(null);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [kind,setKind] = useState('all');
  const [reload,setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/assets/${assetId}/history`,{cache:'no-store',signal:controller.signal})
      .then(readApiResponse).then((data) => {setEvents(data.events);setCursor(data.nextCursor);})
      .catch((caught) => {if (!controller.signal.aborted) setError(caught.message);})
      .finally(() => {if (!controller.signal.aborted) setBusy(false);});
    return () => controller.abort();
  },[assetId,reload]);
  async function more() {
    setBusy(true);setError('');
    try {
      const data = await readApiResponse(await fetch(`/api/assets/${assetId}/history?cursor=${encodeURIComponent(cursor)}`,{cache:'no-store'}));
      setEvents((current) => [...current,...data.events]);setCursor(data.nextCursor);
    } catch(caught) {setError(caught.message);} finally {setBusy(false);}
  }
  const visible = events.filter((event) => kind === 'all' || kind === event.kind);
  return <section id="asset-history" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">ประวัติ Asset รวม</h2>
      <button type="button" disabled={busy} onClick={() => {setError('');setBusy(true);setReload((n) => n+1);}} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm disabled:opacity-50">โหลดล่าสุด</button></div>
    <p className="mt-2 text-sm text-slate-500">เรียงรายการล่าสุดก่อน · ประวัติเก่าที่ไม่ได้บันทึกผู้ทำรายการจะแสดงว่าไม่ระบุ</p>
    <label className="mt-4 block text-sm font-medium">ประเภทประวัติ<select value={kind} onChange={(e) => setKind(e.target.value)} className="ml-3 min-h-11 max-w-full rounded-xl border border-slate-300 bg-white px-3">{Object.entries(kinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <ol className="mt-5 space-y-4">
      {visible.map((event) => <li key={event.event_key} className="border-l-4 border-blue-200 pl-4">
        <p className="font-semibold text-slate-900">{event.title}</p>
        <p className="mt-1 text-xs text-slate-500">{date(event.occurred_at,event.event_key.startsWith('legacy_return:'))} · ผู้บันทึก: {event.actor || 'ไม่ระบุ (ข้อมูลเดิม / ระบบ)'}</p>
        <dl className="mt-2 space-y-1 text-sm text-slate-700">
          {Object.entries(event.details || {}).filter(([,value]) => value != null && value !== '').map(([label,value]) => <div key={label} className="break-words whitespace-pre-wrap"><dt className="inline font-medium">{label}: </dt><dd className="inline">{String(value)}</dd></div>)}
          {event.changes.map((change) => <div key={change.field} className="break-words whitespace-pre-wrap"><dt className="inline font-medium">{change.field}: </dt><dd className="inline">{change.before ?? 'ไม่ระบุ'} → {change.after ?? 'ไม่ระบุ'}</dd></div>)}
        </dl>
      </li>)}
    </ol>
    {!busy && !error && !visible.length && <p className="mt-4 text-sm text-slate-500">ยังไม่มีประวัติประเภทนี้ในรายการที่โหลด{cursor ? ' · กดโหลดประวัติเพิ่มเพื่อดูรายการเก่า' : ''}</p>}
    {busy && <p role="status" className="mt-4 text-blue-700">กำลังโหลดประวัติ…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {cursor && <button type="button" onClick={more} disabled={busy} className="mt-4 min-h-11 rounded-xl border border-slate-300 px-5 disabled:opacity-50">โหลดประวัติเพิ่ม</button>}
  </section>;
}
