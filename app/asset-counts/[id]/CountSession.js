"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AssetQrScanner from '@/app/components/AssetQrScanner';
import EmployeePicker from '@/app/components/EmployeePicker';
import QuickPhotoUpload from '@/app/assets/QuickPhotoUpload';
import { readApiResponse } from '@/lib/client-api';
import { colors, countCsv, formatCountTime, results } from '../count-ui';

function CheckForm({ sessionId,item,locations,users,onSaved,onBusyChange }) {
  const [result,setResult] = useState(item.result === 'pending' ? 'found' : item.result);
  const [locationId,setLocationId] = useState(String((item.result === 'pending' ? item.expected_location_id : item.observed_location_id) ?? ''));
  const [holderId,setHolderId] = useState(String((item.result === 'pending' ? item.expected_holder_id : item.observed_holder_id) ?? ''));
  const [notes,setNotes] = useState(item.notes || '');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const request = useRef(null);
  const saving = useRef(false);
  const mismatch = result !== 'missing' && (result === 'mismatch' || String(item.expected_location_id ?? '') !== locationId || String(item.expected_holder_id ?? '') !== holderId);
  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true);onBusyChange(true);setError('');
    const payload = { result,observedLocationId:locationId,observedHolderId:holderId,notes,expectedVersion:item.version };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = {signature,id:crypto.randomUUID()};
    try {
      const data = await readApiResponse(await fetch(`/api/asset-counts/${sessionId}/items/${item.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:request.current.id})}));
      onSaved(data.item);
    } catch(caught) {setError(caught.message);} finally {saving.current=false;setBusy(false);onBusyChange(false);}
  }
  return <form onSubmit={save} className="space-y-4 border-t border-slate-200 pt-5">
    <fieldset disabled={busy} className="space-y-4">
      <legend className="mb-2 font-semibold">ผลตรวจจากเครื่องจริง</legend>
      <div className="flex flex-wrap gap-2">{Object.entries(results).filter(([key]) => key !== 'pending').map(([key,label]) => <label key={key} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 ${result === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}><input type="radio" name={`result-${item.id}`} value={key} checked={result === key} onChange={() => setResult(key)} />{label}</label>)}</div>
      {result !== 'missing' && <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">สถานที่ที่พบ<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">ไม่ระบุสถานที่</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <EmployeePicker label="ผู้ถือที่พบ" users={users} value={holderId} onChange={setHolderId} emptyLabel="ไม่มีผู้ถือ" disabled={busy} />
      </div>}
      {mismatch && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">จะบันทึกเป็น “ข้อมูลไม่ตรง” กรุณาระบุรายละเอียดเพื่อให้ IT ตรวจสอบต่อ</p>}
      <label className="block text-sm font-medium">หมายเหตุ / รายละเอียดที่ไม่ตรง{mismatch ? ' *' : ''}<textarea required={mismatch} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 p-3" /></label>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <button disabled={busy} className="min-h-12 w-full rounded-xl bg-emerald-600 px-5 font-semibold text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : item.version ? 'บันทึกผลตรวจใหม่' : 'บันทึกผลตรวจนับ'}</button>
  </form>;
}

export default function CountSession({ id,canWrite,locations,users }) {
  const [data,setData] = useState(null);
  const [active,setActive] = useState(null);
  const [busy,setBusy] = useState(false);
  const [checking,setChecking] = useState(false);
  const [photoPending,setPhotoPending] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [filter,setFilter] = useState('all');
  const [search,setSearch] = useState('');
  const [reload,setReload] = useState(0);
  const load = useCallback(async () => readApiResponse(await fetch(`/api/asset-counts/${id}`,{cache:'no-store'})),[id]);
  useEffect(() => {
    let cancelled = false;
    load().then((next) => {if (!cancelled) setData(next);}).catch((caught) => {if (!cancelled) setError(caught.message);});
    return () => {cancelled=true;};
  },[load,reload]);
  async function scan(code) {
    if (busy || !data) return;
    setBusy(true);setError('');setMessage('');
    try {
      const found = await readApiResponse(await fetch(`/api/assets/lookup?code=${encodeURIComponent(code)}`,{cache:'no-store'}));
      const item = data.items.find((entry) => entry.asset_id === found.asset.id);
      if (!item) throw new Error(`${found.asset.asset_code} ไม่อยู่ในขอบเขตรอบนี้ หากต้องการเพิ่มรูปอย่างเดียวให้ใช้เมนูสแกน QR / เพิ่มรูป`);
      setActive(item);
    } catch(caught) {setError(caught.message);} finally {setBusy(false);}
  }
  async function refresh() {
    setBusy(true);setError('');
    try {const next=await load();setData(next);if (active) setActive(next.items.find((i) => i.id === active.id) || null);}
    catch(caught) {setError(caught.message);} finally {setBusy(false);}
  }
  async function close() {
    if (!window.confirm(`ปิดรอบ “${data.session.name}”? ยังไม่ตรวจ ${data.session.pending} รายการจะคงสถานะยังไม่ตรวจ หลังปิดจะดูผลได้แต่แก้ไขไม่ได้`)) return;
    setBusy(true);setError('');
    try {
      await readApiResponse(await fetch(`/api/asset-counts/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'close'})}));
      setData(await load());setMessage('ปิดรอบตรวจนับแล้ว');
    } catch(caught) {setError(caught.message);} finally {setBusy(false);}
  }
  function saved(item) {
    setActive(item);
    setData((current) => {
      const items=current.items.map((entry) => entry.id === item.id ? item : entry);
      const counts={pending:0,found:0,mismatch:0,missing:0};
      for (const entry of items) counts[entry.result] += 1;
      return {...current,items,session:{...current.session,...counts}};
    });
    setMessage(`${item.asset_code}: บันทึกผล “${results[item.result]}” แล้ว`);
  }
  function exportCsv() {
    const url=URL.createObjectURL(new Blob([countCsv(data.items)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`asset-count-${id}.csv`;link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  const locked=busy || checking || photoPending;
  const filtered=data?.items.filter((i) => (filter === 'all' || filter === i.result) && `${i.asset_code} ${i.asset_name || ''} ${i.expected_holder_name || ''}`.toLowerCase().includes(search.trim().toLowerCase())) || [];
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
    <Link href="/asset-counts" className="text-sm text-blue-700">← รอบตรวจนับทั้งหมด</Link>
    {!data && !error && <p role="status">กำลังโหลดรอบตรวจนับ…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}{!data && <button type="button" onClick={() => {setError('');setReload((n) => n+1);}} className="ml-3 underline">ลองใหม่</button>}</div>}
    {data && <>
      <header className="rounded-2xl bg-slate-900 p-5 text-white"><p className="text-sm text-blue-200">{data.session.status === 'open' ? 'กำลังตรวจนับ' : 'ปิดรอบแล้ว'}</p><h1 className="mt-1 text-2xl font-bold">{data.session.name}</h1><p className="mt-2 text-sm text-slate-300">{data.session.location_name || 'ทุกสถานที่'} · {data.session.asset_type_name || 'ทุกประเภท'} · เปิดรอบ {formatCountTime(data.session.created_at)}</p>{data.session.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{data.session.notes}</p>}{data.session.closed_at && <p className="mt-2 text-sm">ปิดรอบ {formatCountTime(data.session.closed_at)} · {data.session.closed_by_name || 'ไม่ระบุ'}</p>}</header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><button onClick={() => setFilter('all')} className="rounded-xl bg-white p-4 text-left shadow-sm"><span className="text-sm">ทั้งหมด</span><strong className="mt-1 block text-2xl">{data.session.total}</strong></button>{Object.entries(results).map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-xl p-4 text-left ${colors[key]} ${filter === key ? 'ring-2 ring-blue-400' : ''}`}><span className="text-sm">{label}</span><strong className="mt-1 block text-2xl">{data.session[key]}</strong></button>)}</div>
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
      {data.session.status === 'open' && !active && canWrite && <AssetQrScanner onScan={scan} disabled={locked} />}
      {active && <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-blue-800">{active.asset_code}</h2><span className={`rounded-full px-3 py-1 text-sm ${colors[active.result]}`}>{results[active.result]}</span></div>
        <p>{active.asset_name}</p><p className="rounded-xl bg-slate-50 p-3 text-sm">ข้อมูล ณ วันเปิดรอบ: {active.expected_status} · {active.expected_location_name || 'ไม่ระบุสถานที่'} · ผู้ถือ {active.expected_holder_name || 'ไม่มี'}</p>
        {active.holder_source === 'legacy_owner' && <p className="text-sm text-amber-800">ผู้ถือตามรายการอ้างอิง Owner เดิม ยังไม่มีประวัติมอบหมาย กรุณาตรวจจากเครื่องจริง</p>}
        <Link href={`/assets/${active.asset_id}#asset-history`} className="inline-block text-sm font-semibold text-blue-700">ดูข้อมูลปัจจุบันและประวัติ Asset →</Link>
        {data.session.status === 'open' && canWrite ? <>
          <CheckForm key={`${active.id}:${active.version}`} sessionId={id} item={active} locations={locations} users={users} onSaved={saved} onBusyChange={setChecking} />
          <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">ถ่ายรูป / เพิ่มรูป Asset นี้</summary><div className="mt-4"><QuickPhotoUpload key={active.asset_id} assetId={active.asset_id} onPendingChange={setPhotoPending} /></div></details>
        </> : <dl className="space-y-2 text-sm"><div>สถานที่ที่พบ: {active.observed_location_name || '-'}</div><div>ผู้ถือที่พบ: {active.observed_holder_name || '-'}</div><div className="whitespace-pre-wrap">หมายเหตุ: {active.notes || '-'}</div><div>ตรวจโดย {active.checked_by_name || 'ไม่ระบุ'} · {formatCountTime(active.checked_at)}</div></dl>}
        <button type="button" disabled={locked} onClick={() => {setActive(null);setMessage('');}} className="min-h-12 w-full rounded-xl border border-slate-300 px-5 font-semibold disabled:opacity-40">{data.session.status === 'open' && canWrite ? 'สแกน / ตรวจชิ้นถัดไป' : 'ปิดรายละเอียด'}</button>
        {photoPending && <p className="text-sm text-slate-500">บันทึกหรือยกเลิกรูปก่อนเปลี่ยนรายการ</p>}
      </section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">รายการในรอบนี้</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={refresh} disabled={locked} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm disabled:opacity-50">โหลดล่าสุด</button><button type="button" onClick={exportCsv} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm">ส่งออกผล CSV</button>{canWrite && data.session.status === 'open' && <button type="button" onClick={close} disabled={locked} className="min-h-11 rounded-xl bg-slate-900 px-3 text-sm text-white disabled:opacity-50">ปิดรอบตรวจนับ</button>}</div></div>
        <label className="mt-4 block text-sm font-medium">ค้นหาในรายการ<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Asset Code / ชื่อ Asset / ผู้ถือ" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3" /></label>
        <p className="mt-3 text-sm text-slate-500">แสดง {filtered.length} รายการ · {filter === 'all' ? 'ทุกผลตรวจ' : results[filter]} · แตะรายการเพื่อดูหรือตรวจนับ</p>
        <div className="mt-4 divide-y divide-slate-100">{filtered.map((item) => <button key={item.id} type="button" disabled={locked} onClick={() => {setActive(item);setMessage('');window.scrollTo({top:0,behavior:'smooth'});}} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left disabled:opacity-40"><div><p className="font-semibold text-blue-800">{item.asset_code} <span className="font-normal text-slate-700">{item.asset_name}</span></p><p className="mt-1 text-xs text-slate-500">{item.expected_location_name || 'ไม่ระบุสถานที่'} · {item.expected_holder_name || 'ไม่มีผู้ถือ'}</p></div><span className={`rounded-full px-3 py-1 text-xs ${colors[item.result]}`}>{results[item.result]}</span></button>)}</div>
      </section>
    </>}
  </div></main>;
}
