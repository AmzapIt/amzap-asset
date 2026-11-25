"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Laptop } from "lucide-react";
import { readApiResponse } from "@/lib/client-api";
import { SPECS_TYPE_PREFIXES } from "@/lib/asset-specs-view";

// ไอคอนหน้ายี่ห้อ/รุ่น: เขียว = นำเข้าสเปกแล้ว, เทา = ยังไม่นำเข้า (เฉพาะ NB / PC)
// ชี้ (หรือแตะไอคอนบนมือถือ) แล้วแสดง Technical Information และ Software
export default function AssetSpecs({ asset, children }) {
  const popupId = useId();
  const anchor = useRef(null);
  const popup = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const pinned = useRef(false);
  const [position, setPosition] = useState(null);
  const [sections, setSections] = useState(null);
  const [error, setError] = useState("");
  const open = Boolean(position);
  const imported = Boolean(asset.specs_imported_date);

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    pinned.current = false;
    setPosition(null);
  }, []);

  function show() {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(380, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const placeAbove = below < 320 && above > below;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      width,
      maxHeight: Math.max(80, Math.min(460, placeAbove ? above : below)),
      transform: placeAbove ? "translateY(-100%)" : undefined,
    });
  }

  // หน่วงเล็กน้อย กันโหลดสเปกทุกแถวตอนลากเมาส์ผ่านตาราง
  function scheduleOpen(event) {
    if (event.pointerType === "touch") return;
    clearTimeout(closeTimer.current);
    if (open) return;
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(show, 200);
  }

  function scheduleClose() {
    clearTimeout(openTimer.current);
    if (pinned.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, 160);
  }

  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  // โหลดใหม่ทุกครั้งที่เปิด ให้เห็นค่าล่าสุดเสมอ
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/assets/${asset.id}/specs`, { signal: controller.signal })
      .then(readApiResponse)
      .then((data) => { setSections(data.sections || []); setError(""); })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message || "โหลดสเปกไม่สำเร็จ"); });
    return () => controller.abort();
  }, [open, asset.id]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!anchor.current?.contains(event.target) && !popup.current?.contains(event.target)) close();
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
  }, [open, close]);

  if (!SPECS_TYPE_PREFIXES.includes(asset.asset_type_prefix)) return children;

  const status = imported ? `นำเข้าสเปกแล้ว · ${asset.specs_imported_date}` : "ยังไม่นำเข้าสเปก";

  return (
    <span ref={anchor} onPointerEnter={scheduleOpen} onPointerLeave={scheduleClose} className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`${status} (${asset.asset_code})`}
        aria-describedby={open ? popupId : undefined}
        aria-expanded={open}
        onBlur={() => { pinned.current = false; scheduleClose(); }}
        onClick={(event) => {
          event.stopPropagation();
          if (pinned.current) close();
          else { pinned.current = true; show(); }
        }}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 md:h-8 md:w-8 ${imported ? "text-emerald-600" : "text-slate-300"}`}
      >
        <Laptop size={18} aria-hidden="true" />
      </button>
      <span>{children}</span>
      {open && createPortal(
        <div
          ref={popup}
          id={popupId}
          role="tooltip"
          style={position}
          onPointerEnter={() => clearTimeout(closeTimer.current)}
          onPointerLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-left text-sm font-normal text-slate-800 shadow-xl"
        >
          <p className="font-semibold">{asset.asset_code}</p>
          <p className={`text-xs ${imported ? "text-emerald-700" : "text-slate-500"}`}>{status}</p>
          {error ? <p className="mt-3 text-red-700">{error}</p>
            : sections === null ? <p className="mt-3 text-slate-500">กำลังโหลด...</p>
              : sections.length === 0 ? <p className="mt-3 text-slate-500">ยังไม่มีข้อมูลสเปก</p>
                : sections.map(({ title, rows }) => (
                  <div key={title} className="mt-3">
                    <p className="text-xs font-semibold text-blue-800">{title}</p>
                    <dl className="mt-1 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1">
                      {rows.map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="break-words [overflow-wrap:anywhere]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
        </div>,
        document.body,
      )}
    </span>
  );
}
