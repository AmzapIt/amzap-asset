"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StickyNote } from "lucide-react";

export default function AssetNote({ notes, assetCode, className = "" }) {
  const note = typeof notes === "string" ? notes.trim() : "";
  const tooltipId = useId();
  const button = useRef(null);
  const tooltip = useRef(null);
  const closeTimer = useRef(null);
  const pinned = useRef(false);
  const [position, setPosition] = useState(null);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    pinned.current = false;
    setPosition(null);
  }, []);

  function show() {
    clearTimeout(closeTimer.current);
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const placeAbove = below < 180 && above > below;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      width,
      maxHeight: Math.max(48, Math.min(320, placeAbove ? above : below)),
      transform: placeAbove ? "translateY(-100%)" : undefined,
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
      if (!button.current?.contains(event.target) && !tooltip.current?.contains(event.target)) close();
    };
    const escape = (event) => { if (event.key === "Escape") close(); };
    const scroll = (event) => {
      // Long notes can scroll inside the tooltip; moving the table closes it.
      if (!tooltip.current?.contains(event.target)) close();
    };
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

  if (!note) return null;

  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <button
        ref={button}
        type="button"
        aria-label={`หมายเหตุของ ${assetCode}`}
        aria-describedby={position ? tooltipId : undefined}
        aria-expanded={Boolean(position)}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") show(); }}
        onPointerLeave={scheduleClose}
        onFocus={show}
        onBlur={() => { pinned.current = false; scheduleClose(); }}
        onClick={(event) => {
          event.stopPropagation();
          if (pinned.current) close();
          else { pinned.current = true; show(); }
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-amber-700 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 md:h-8 md:w-8"
      >
        <StickyNote size={18} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={tooltip}
          id={tooltipId}
          role="tooltip"
          style={position}
          onPointerEnter={() => clearTimeout(closeTimer.current)}
          onPointerLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm font-normal text-slate-800 shadow-xl"
        >
          <p className="mb-2 font-semibold text-amber-900">หมายเหตุ · {assetCode}</p>
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{note}</p>
        </div>,
        document.body,
      )}
    </span>
  );
}
