"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function AssetPhotoPreview({ assetId, assetCode, photoId }) {
  const [position, setPosition] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const previewId = useId();
  const button = useRef(null);
  const popup = useRef(null);
  const closeTimer = useRef(null);
  const pinned = useRef(false);
  const src = photoId
    ? `/api/assets/${assetId}/photo-preview/${photoId}${retry ? `?retry=${retry}` : ""}`
    : null;

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    pinned.current = false;
    setPosition(null);
  }, []);

  function show() {
    clearTimeout(closeTimer.current);
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 24, Math.max(160, window.innerHeight - 96));
    const popupHeight = width + 52;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const placeAbove = below < popupHeight + 12 && above > below;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: placeAbove ? Math.max(12, rect.top - popupHeight - 8) : Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - popupHeight - 12)),
      width,
    });
  }

  function scheduleClose() {
    if (pinned.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, 160);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!position) return;
    const outside = (event) => {
      if (!button.current?.contains(event.target) && !popup.current?.contains(event.target)) close();
    };
    const escape = (event) => { if (event.key === "Escape") close(); };
    const scroll = (event) => { if (!popup.current?.contains(event.target)) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [position, close]);

  if (!src || failed) {
    const placeholder = (
      <>
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <ImageOff size={18} aria-hidden="true" />
        </span>
        <span>{failed ? "ลองโหลดรูปอีกครั้ง" : "ไม่มีรูป"}</span>
      </>
    );
    return (
      <div className="inline-block">
        {failed ? (
          <button
            type="button"
            aria-label={`ลองโหลดรูป ${assetCode} อีกครั้ง`}
            onClick={(event) => {
              event.stopPropagation();
              setRetry((previous) => previous + 1);
              setFailed(false);
            }}
            className="inline-flex min-h-12 items-center gap-2 text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {placeholder}
          </button>
        ) : (
          <span className="inline-flex min-h-12 items-center gap-2 text-xs text-slate-500" aria-label={`${assetCode} ยังไม่มีรูป`}>
            {placeholder}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-block">
      <span className="inline-flex">
        <button
          ref={button}
          type="button"
          aria-label={`ดูรูป ${assetCode} ขนาดใหญ่`}
          aria-describedby={position ? previewId : undefined}
          aria-expanded={Boolean(position)}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") show(); }}
          onPointerLeave={scheduleClose}
          onFocus={show}
          onBlur={scheduleClose}
          onClick={(event) => {
            event.stopPropagation();
            if (pinned.current) close();
            else { pinned.current = true; show(); }
          }}
          className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition hover:border-blue-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Image
            src={src}
            alt={`รูป ${assetCode}`}
            width={48}
            height={48}
            unoptimized
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => { setFailed(true); close(); }}
          />
        </button>
        {position && createPortal(
          <div
            ref={popup}
            id={previewId}
            role="tooltip"
            style={position}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            onPointerLeave={scheduleClose}
            onClick={(event) => event.stopPropagation()}
            className="fixed z-[100] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
          >
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-slate-50">
              <Image
                src={src}
                alt={`รูปขนาดใหญ่ของ ${assetCode}`}
                width={384}
                height={384}
                unoptimized
                className="max-h-full max-w-full object-contain"
                onError={() => { setFailed(true); close(); }}
              />
            </div>
            <p className="truncate px-1 pt-2 text-sm font-semibold text-slate-800">{assetCode}</p>
          </div>,
          document.body,
        )}
      </span>
    </div>
  );
}
