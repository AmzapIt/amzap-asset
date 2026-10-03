"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readApiResponse } from '@/lib/client-api';
import { formatCountTime } from './count-ui';

export default function CountSessions({ canWrite, locations, types }) {
  const router = useRouter();
  const [sessions,setSessions] = useState([]);
  const [name,setName] = useState('');
  const [locationId,setLocationId] = useState('');
  const [assetTypeId,setAssetTypeId] = useState('');
  const [notes,setNotes] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [reload,setReload] = useState(0);
  const request = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/asset-counts',{cache:'no-store',signal:controller.signal}).then(readApiResponse)
      .then((data) => setSessions(data.sessions))
      .catch((caught) => {if (!controller.signal.aborted) setError(caught.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  },[reload]);
  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);setError('');
    const payload = {name,locationId,assetTypeId,notes};
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = {signature,id:crypto.randomUUID()};
    try {
      const data = await readApiResponse(await fetch('/api/asset-counts',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...payload,requestId:request.current.id})}));
      router.push(`/asset-counts/${data.session.id}`);
    } catch(caught) {setError(caught.message);setBusy(false);}
  }
  const input = 'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3';
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-bold">ตรวจนับ Asset</h1><p className="mt-2 text-slate-600">เปิดรอบตรวจนับ แล้วสแกนสติ๊กเกอร์เดิมเพื่อบันทึกสิ่งที่พบจริง</p></header>
    {canWrite && <form onSubmit={create} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">เปิดรอบตรวจนับใหม่</h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">ชื่อรอบตรวจนับ<input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ตรวจนับโรงงาน 1 ตุลาคม 2569" className={input} /></label>
        <label className="text-sm font-medium">สถานที่<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}><option value="">ทุกสถานที่</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="text-sm font-medium">ประเภท Asset<select value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} className={input}><option value="">ทุกประเภท</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">หมายเหตุ<textarea maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} py-3`} /></label>
      </fieldset>
      <p className="text-sm text-slate-500">เก็บรายการและข้อมูลตามวันเปิดรอบ ไม่รวม Asset สถานะ Disposed · ผลตรวจนับไม่เปลี่ยนผู้ถือ สถานที่ หรือสถานะ Asset อัตโนมัติ</p>
      <button disabled={busy} className="min-h-12 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-50">{busy ? 'กำลังเปิดรอบ…' : 'เปิดรอบตรวจนับ'}</button>
    </form>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">รอบตรวจนับล่าสุด</h2><button type="button" disabled={loading || busy} onClick={() => {setError('');setLoading(true);setReload((n) => n+1);}} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm">โหลดล่าสุด</button></div>
    {loading && <p role="status">กำลังโหลด…</p>}
    {!loading && !sessions.length && <p className="rounded-xl bg-white p-5 text-slate-500">ยังไม่มีรอบตรวจนับ</p>}
    <div className="grid gap-4 lg:grid-cols-2">{sessions.map((s) => <Link key={s.id} href={`/asset-counts/${s.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400">
      <div className="flex justify-between gap-3"><h3 className="font-semibold">{s.name}</h3><span className={`shrink-0 rounded-full px-3 py-1 text-xs ${s.status === 'open' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{s.status === 'open' ? 'กำลังตรวจ' : 'ปิดรอบแล้ว'}</span></div>
      <p className="mt-2 text-sm text-slate-500">{s.location_name || 'ทุกสถานที่'} · {s.asset_type_name || 'ทุกประเภท'}</p>
      <p className="mt-3 text-sm">ทั้งหมด {s.total} · พบแล้ว {s.found} · ไม่ตรง {s.mismatch} · ไม่พบ {s.missing} · ยังไม่ตรวจ {s.pending}</p>
      <p className="mt-3 text-xs text-slate-500">{formatCountTime(s.created_at)} · {s.created_by_name || 'ไม่ระบุ'}</p>
    </Link>)}</div>
  </div></main>;
}
