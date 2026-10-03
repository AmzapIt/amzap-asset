"use client";

import { useEffect, useState } from 'react';
import AssetPhotoField from './AssetPhotoField';
import { readApiResponse } from '@/lib/client-api';

export default function QuickPhotoUpload({ assetId, onUploaded, onPendingChange }) {
  const [photo,setPhoto] = useState(null);
  const [processing,setProcessing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [resetKey,setResetKey] = useState(0);
  useEffect(() => { onPendingChange?.(busy || processing || Boolean(photo)); }, [busy,processing,photo,onPendingChange]);
  async function upload() {
    if (!photo || busy || processing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = new FormData(); data.append('photo',photo);
      const response = await readApiResponse(await fetch(`/api/assets/${assetId}/photos`,{ method:'POST',body:data }));
      setPhoto(null); setResetKey((n) => n+1);
      setMessage('บันทึกรูปแล้ว รูปนี้เป็นรูปหลัก และเก็บรูปก่อนหน้าไว้ในประวัติ');
      onUploaded?.(response.photo);
    } catch(caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <AssetPhotoField key={resetKey} photo={photo} disabled={busy}
      onChange={(value) => { setPhoto(value); setError(''); setMessage(''); }}
      onProcessingChange={setProcessing} />
    <button type="button" onClick={upload} disabled={!photo || processing || busy} className="min-h-12 w-full rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-40">{busy ? 'กำลังอัปโหลดรูป…' : 'บันทึกรูป Asset'}</button>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
