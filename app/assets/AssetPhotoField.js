"use client";

import { useCallback, useId, useRef, useState } from "react";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const TARGET_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1920;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONVERTIBLE_TYPES = new Set([
  ...ALLOWED_TYPES,
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function canPreparePhoto(file) {
  return (
    CONVERTIBLE_TYPES.has(file.type.toLowerCase()) ||
    /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name)
  );
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("ไม่สามารถแปลงรูปเป็น JPG ได้"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function preparePhoto(file) {
  // ไฟล์ที่เล็กอยู่แล้วไม่ต้องแปลงซ้ำ เพื่อไม่ลดคุณภาพโดยไม่จำเป็น
  if (ALLOWED_TYPES.has(file.type) && file.size <= TARGET_PHOTO_BYTES) {
    return file;
  }

  if (!canPreparePhoto(file)) {
    throw new Error("รองรับเฉพาะรูป JPG, PNG, WebP, HEIC และ HEIF");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("ไม่สามารถอ่านรูปจากกล้องได้"));
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const initialScale = Math.min(1, MAX_PHOTO_DIMENSION / longestSide);
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
    let lastBlob = null;

    // ลดคุณภาพก่อน แล้วค่อยลดความละเอียดหากรูปยังเกินเป้าหมาย 1.5 MB
    // เพื่อคงรายละเอียดบนป้าย Serial/Asset ให้ชัดที่สุดเท่าที่ทำได้
    for (let resizePass = 0; resizePass < 3; resizePass += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการเตรียมรูป");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of [0.88, 0.76, 0.64, 0.52]) {
        lastBlob = await canvasToJpeg(canvas, quality);
        if (lastBlob.size <= TARGET_PHOTO_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "asset-photo";
          return new File([lastBlob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: file.lastModified || Date.now(),
          });
        }
      }

      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }

    // หากรูปซับซ้อนมากจนไม่ถึงเป้าหมาย แต่ยังต่ำกว่าเพดานของ Server
    // ให้ใช้ผลลัพธ์ที่เล็กที่สุดแทนการบังคับผู้ใช้ถ่ายใหม่
    if (lastBlob && lastBlob.size <= MAX_PHOTO_BYTES) {
      const baseName = file.name.replace(/\.[^.]+$/, "") || "asset-photo";
      return new File([lastBlob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      });
    }

    throw new Error("รูปมีขนาดใหญ่เกินไปและไม่สามารถย่อให้ต่ำกว่า 4 MB ได้");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function AssetPhotoField({
  disabled = false,
  onChange,
  onProcessingChange = () => {},
  photo,
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef(null);
  const galleryRef = useRef(null);
  const inputId = useId();
  const selectionIdRef = useRef(0);

  // React 19 เรียก cleanup ของ callback ref เมื่อเปลี่ยนรูปหรือถอด Preview
  // จึงคืน Object URL ได้โดยไม่ต้องใช้ state/effect เพิ่มเพื่อแสดงรูป
  const previewRef = useCallback((image) => {
    if (!image || !photo) return undefined;
    const url = URL.createObjectURL(photo);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function selectPhoto(event) {
    const selectionId = selectionIdRef.current + 1;
    selectionIdRef.current = selectionId;
    const selected = event.target.files?.[0] || null;
    setError("");

    if (!selected) {
      onChange(null);
      return;
    }

    setProcessing(true);
    onProcessingChange(true);
    onChange(null);

    try {
      const prepared = await preparePhoto(selected);
      if (selectionId !== selectionIdRef.current) return;
      onChange(prepared);
    } catch (prepareError) {
      if (selectionId !== selectionIdRef.current) return;
      event.target.value = "";
      setError(
        prepareError.message ||
          "ไม่สามารถเตรียมรูปจากกล้องได้ กรุณาลองถ่ายใหม่",
      );
    } finally {
      if (selectionId === selectionIdRef.current) {
        setProcessing(false);
        onProcessingChange(false);
      }
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="block font-medium text-slate-800" htmlFor={inputId}>
        รูป Asset
      </label>
      <p className="mt-1 text-sm text-slate-500">
        ถ่ายรูปจากกล้องหรือเลือกจากคลังรูป ระบบจะย่อและแปลง HEIC/HEIF
        เป็น JPG ให้อัตโนมัติ โดยตั้งเป้าขนาดไม่เกิน 1.5 MB
      </p>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || processing}
        onChange={selectPhoto}
        aria-busy={processing}
        className="sr-only"
      />
      <input ref={galleryRef} type="file" accept="image/*" disabled={disabled || processing}
        onChange={selectPhoto} aria-label="เลือกจากคลังรูป" className="sr-only" />
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || processing}
          className="min-h-12 rounded-xl bg-slate-900 px-5 font-semibold text-white disabled:opacity-50">ถ่ายรูป</button>
        <button type="button" onClick={() => galleryRef.current?.click()} disabled={disabled || processing}
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium disabled:opacity-50">เลือกจากคลังรูป</button>
      </div>

      {processing && (
        <p role="status" className="mt-2 text-sm text-blue-700">
          กำลังเตรียมรูปจากกล้อง...
        </p>
      )}
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
              disabled={disabled || processing}
              onClick={() => {
                selectionIdRef.current += 1;
                if (inputRef.current) inputRef.current.value = "";
                if (galleryRef.current) galleryRef.current.value = "";
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
