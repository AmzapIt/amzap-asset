"use client";

import { useCallback, useRef, useState } from "react";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function AssetPhotoField({ disabled = false, onChange, photo }) {
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // React 19 เรียก cleanup ของ callback ref เมื่อเปลี่ยนรูปหรือถอด Preview
  // จึงคืน Object URL ได้โดยไม่ต้องใช้ state/effect เพิ่มเพื่อแสดงรูป
  const previewRef = useCallback((image) => {
    if (!image || !photo) return undefined;
    const url = URL.createObjectURL(photo);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function selectPhoto(event) {
    const selected = event.target.files?.[0] || null;
    setError("");

    if (!selected) {
      onChange(null);
      return;
    }
    if (!ALLOWED_TYPES.has(selected.type)) {
      event.target.value = "";
      onChange(null);
      setError("รองรับเฉพาะรูป JPG, PNG และ WebP");
      return;
    }
    if (selected.size > MAX_PHOTO_BYTES) {
      event.target.value = "";
      onChange(null);
      setError("ขนาดรูปต้องไม่เกิน 4 MB");
      return;
    }

    onChange(selected);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="block font-medium text-slate-800" htmlFor="assetPhoto">
        รูป Asset
      </label>
      <p className="mt-1 text-sm text-slate-500">
        ถ่ายรูปจากกล้องหรือเลือกรูป JPG, PNG, WebP ขนาดไม่เกิน 4 MB
      </p>

      <input
        ref={inputRef}
        id="assetPhoto"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        onChange={selectPhoto}
        className="mt-3 block w-full rounded-lg border border-slate-200 bg-white p-3 text-sm disabled:opacity-50"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {photo && (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img
            ref={previewRef}
            alt="ตัวอย่างรูป Asset ที่เลือก"
            className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
          />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">{photo.name}</p>
            <p className="mt-1">{(photo.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                onChange(null);
              }}
              className="mt-2 font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              ยกเลิกรูปนี้
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
