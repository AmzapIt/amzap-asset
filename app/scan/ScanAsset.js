"use client";

import { useState } from 'react';
import Link from 'next/link';
import AssetQrScanner from '@/app/components/AssetQrScanner';
import QuickPhotoUpload from '@/app/assets/QuickPhotoUpload';
import { readApiResponse } from '@/lib/client-api';

export default function ScanAsset({ canWrite }) {
  const [asset,setAsset] = useState(null);
  const [busy,setBusy] = useState(false);
  const [photoPending,setPhotoPending] = useState(false);
  const [error,setError] = useState('');
  async function lookup(code) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await readApiResponse(await fetch(`/api/assets/lookup?code=${encodeURIComponent(code)}`, { cache:'no-store' }));
      setAsset(data.asset);
    } catch(caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-5">
      <header><h1 className="text-2xl font-bold">สแกน QR / เพิ่มรูป Asset</h1><p className="mt-2 text-slate-600">สแกนรหัสบนสติ๊กเกอร์เพื่อดูข้อมูลและถ่ายรูปเก็บได้ทันที</p></header>
      {!asset && <AssetQrScanner onScan={lookup} disabled={busy} />}
      {busy && <p role="status" className="text-blue-700">กำลังค้นหา Asset…</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {asset && <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-blue-800">{asset.asset_code}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">{asset.status}</span></div>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {Object.entries({ 'ชื่อ Asset':asset.asset_name, 'ประเภท':asset.asset_type, 'ยี่ห้อ / รุ่น':[asset.brand,asset.model].filter(Boolean).join(' '), 'Serial Number':asset.serial_number,'สถานที่':asset.location_name,'ผู้ครอบครอง':asset.holder_name || 'ไม่มี','Asset Owner':asset.owner_name || 'ไม่มี','รูปที่บันทึก':`${asset.photo_count} รูป` }).map(([label,value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value || '-'}</dd></div>)}
        </dl>
        {asset.holder_source === 'legacy_owner' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">ผู้ครอบครองอ้างอิง Owner เดิม ยังไม่มีประวัติมอบหมาย กรุณาตรวจเครื่องจริงประกอบ</p>}
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-blue-700">
          <Link href={`/assets/${asset.id}`}>ดูรายละเอียดทั้งหมด →</Link>
          <Link href={`/assets/${asset.id}#asset-history`}>ประวัติ Asset →</Link>
          {asset.photo?.storage_path?.startsWith('https://') && <a href={asset.photo.storage_path} target="_blank" rel="noreferrer">เปิดรูปหลัก ↗</a>}
        </div>
        {canWrite && <QuickPhotoUpload key={asset.id} assetId={asset.id} onPendingChange={setPhotoPending} onUploaded={(photo) => setAsset((current) => ({ ...current,photo,photo_count:current.photo_count+1 }))} />}
        <button type="button" disabled={photoPending} onClick={() => {setAsset(null);setError('');}} className="min-h-12 w-full rounded-xl border border-slate-300 px-5 font-semibold disabled:opacity-40">สแกนชิ้นถัดไป</button>
        {photoPending && <p className="text-sm text-slate-500">บันทึกหรือยกเลิกรูปที่เลือกก่อนสแกนชิ้นถัดไป</p>}
      </section>}
      <Link href="/asset-counts" className="block rounded-xl border border-blue-100 bg-blue-50 p-4 font-semibold text-blue-800">ต้องการตรวจนับหลายชิ้น? เปิดรอบตรวจนับ Asset →</Link>
    </div>
  </main>;
}
