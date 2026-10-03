"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Search, Square } from 'lucide-react';

export default function AssetQrScanner({ onScan, disabled = false }) {
  const [mode, setMode] = useState('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const video = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const generation = useRef(0);
  const inputId = useId();
  const latestScan = useRef(onScan);
  useEffect(() => { latestScan.current = onScan; }, [onScan]);

  const release = useCallback(() => {
    generation.current += 1;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => {
    const pause = () => { if (document.hidden) { release(); setMode('idle'); } };
    document.addEventListener('visibilitychange', pause);
    return () => { release(); document.removeEventListener('visibilitychange', pause); };
  }, [release]);

  async function start() {
    release();
    const attempt = generation.current;
    setError('');
    setMode('starting');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('เปิดกล้องไม่ได้ กรุณาเปิดเว็บผ่าน HTTPS ใน Safari หรือ Chrome หรือกรอก Asset Code ด้านล่าง');
      }
      const { default: jsQR } = await import('jsqr');
      if (attempt !== generation.current) return;
      const camera = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (attempt !== generation.current) { camera.getTracks().forEach((track) => track.stop()); return; }
      stream.current = camera;
      video.current.srcObject = camera;
      await video.current.play();
      if (attempt !== generation.current) return;
      setMode('camera');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('อุปกรณ์นี้ไม่รองรับการอ่าน QR จากกล้อง');
      const tick = () => {
        if (attempt !== generation.current) return;
        const frame = video.current;
        if (frame?.readyState >= 2 && frame.videoWidth > 0) {
          const scale = Math.min(1, 960 / Math.max(frame.videoWidth,frame.videoHeight));
          canvas.width = Math.round(frame.videoWidth * scale);
          canvas.height = Math.round(frame.videoHeight * scale);
          context.drawImage(frame,0,0,canvas.width,canvas.height);
          const pixels = context.getImageData(0,0,canvas.width,canvas.height);
          const decoded = jsQR(pixels.data,pixels.width,pixels.height,{ inversionAttempts: 'dontInvert' });
          if (decoded?.data) {
            release(); setMode('idle'); setCode(decoded.data);
            latestScan.current(decoded.data);
            return;
          }
        }
        timer.current = setTimeout(tick,180);
      };
      tick();
    } catch (caught) {
      if (attempt !== generation.current) return;
      release(); setMode('idle');
      setError(caught.name === 'NotAllowedError'
        ? 'กรุณาอนุญาตใช้กล้อง หากเปิดจาก LINE ให้เปิดลิงก์ใน Safari หรือ Chrome แล้วลองอีกครั้ง'
        : caught.name === 'NotFoundError' ? 'ไม่พบกล้อง กรุณาเลือกรูป QR หรือกรอก Asset Code' : caught.message);
    }
  }

  async function readImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    release();
    const attempt = generation.current;
    setError(''); setMode('image');
    let url;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('รูป QR ต้องไม่เกิน 20 MB');
      const { default: jsQR } = await import('jsqr');
      const img = new window.Image();
      url = URL.createObjectURL(file);
      await new Promise((resolve,reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('อ่านรูปนี้ไม่ได้ กรุณาใช้รูป JPG หรือ PNG'));
        img.src = url;
      });
      if (attempt !== generation.current) return;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
      canvas.width = Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height = Math.max(1,Math.round(img.naturalHeight*scale));
      const context = canvas.getContext('2d');
      context.drawImage(img,0,0,canvas.width,canvas.height);
      const pixels = context.getImageData(0,0,canvas.width,canvas.height);
      const decoded = jsQR(pixels.data,pixels.width,pixels.height);
      if (!decoded?.data) throw new Error('ไม่พบ QR ในรูป กรุณาถ่ายให้เห็น QR ชัดเจน หรือกรอก Asset Code');
      setCode(decoded.data);
      latestScan.current(decoded.data);
    } catch (caught) {
      if (attempt === generation.current) setError(caught.message);
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (attempt === generation.current) setMode('idle');
    }
  }

  const working = mode !== 'idle';
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-semibold">สแกนสติ๊กเกอร์ Asset</h2>
    <p className="mt-1 text-sm text-slate-500">ใช้ QR เดิมที่เป็น Asset Code · หันกล้องหลังเข้าหาป้าย</p>
    <video ref={video} muted playsInline autoPlay aria-label="ภาพจากกล้องสำหรับสแกน QR"
      className={`${mode === 'camera' || mode === 'starting' ? 'block' : 'hidden'} mt-4 aspect-[4/3] max-h-96 w-full rounded-xl bg-slate-950 object-contain`} />
    <div className="mt-4 flex flex-wrap gap-3">
      {!working ? <button type="button" disabled={disabled} onClick={start} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-50"><Camera size={20} />เปิดกล้องสแกน</button>
        : <button type="button" onClick={() => { release(); setMode('idle'); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-5"><Square size={18} />หยุดกล้อง / ยกเลิก</button>}
      <label className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 ${disabled || working ? 'opacity-50' : 'cursor-pointer'}`}>
        <ImagePlus size={20} />อ่าน QR จากรูป
        <input type="file" accept="image/*" onChange={readImage} disabled={disabled || working} className="sr-only" />
      </label>
    </div>
    {working && <p role="status" className="mt-3 text-sm text-blue-700">{mode === 'camera' ? 'กำลังสแกน… วาง QR ให้ชัดและถือกล้องนิ่งสักครู่' : mode === 'image' ? 'กำลังอ่าน QR จากรูป…' : 'กำลังเปิดกล้อง…'}</p>}
    <form className="mt-5" onSubmit={(event) => { event.preventDefault(); setError(''); latestScan.current(code); }}>
      <label htmlFor={inputId} className="text-sm font-medium">หรือกรอก / ยิงเครื่องอ่าน Asset Code</label>
      <div className="mt-2 flex gap-2">
        <input id={inputId} value={code} onChange={(event) => setCode(event.target.value)} maxLength={100} required autoComplete="off" autoCapitalize="characters" placeholder="F1-MON-001" disabled={disabled || working} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3" />
        <button disabled={disabled || working} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-4 text-white disabled:opacity-50"><Search size={18} />ค้นหา</button>
      </div>
    </form>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </section>;
}
