"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessoryActionForm from "./AccessoryActionForm";
import AccessoryHistory from "./AccessoryHistory";
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass } from "./accessory-ui";

const number = (value) => Number(value || 0).toLocaleString("th-TH");

// เมนูการทำงานรองของแต่ละรายการ · ปิดเมื่อคลิกนอกเมนูหรือกด Esc
function RowMenu({ stock, canWrite, onPick }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.type === "keydown" ? event.key === "Escape" : !box.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const items = [
    canWrite && ["receive", "รับเข้า", !stock.is_active],
    canWrite && ["editStock", "แก้ไขข้อมูล", false],
    ["history", "ประวัติ", false],
    canWrite && ["disposeStock", "นำออกจากคลัง…", !stock.available_quantity, "text-amber-800"],
  ].filter(Boolean);
  return <div ref={box} className="relative">
    <button type="button" className={`${buttonClass} px-3`} aria-haspopup="menu" aria-expanded={open} aria-label="การทำงานอื่น" onClick={() => setOpen((v) => !v)}>⋯</button>
    {open && <ul role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left text-sm shadow-lg">
      {items.map(([mode, label, disabled, tone]) => <li key={mode} role="none">
        <button type="button" role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onPick(mode); }}
          className={`block w-full px-4 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${tone || "text-slate-700"}`}>{label}</button>
      </li>)}
    </ul>}
  </div>;
}

function Holders({ stock, holdings }) {
  const rows = holdings.filter((h) => h.stock_item_id === stock.id);
  return <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
    {rows.map((h) => <li key={h.user_id} className="flex justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
      <Link href={`/users/${h.user_id}`} className="min-w-0 truncate text-blue-700 hover:underline">{personLabel(h)}</Link><span className="shrink-0">{h.quantity} ชิ้น</span>
    </li>)}
  </ul>;
}

export default function StockManager({ initialInventory, canWrite }) {
  const router = useRouter();
  const [data, setData] = useState(initialInventory);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStock, setHistoryStock] = useState("");
  const [history, setHistory] = useState({ movements: initialInventory.movements, hasMore: initialInventory.hasMore });
  const historyPanel = useRef(null);

  useEffect(() => {
    if (!action) return undefined;
    const close = (event) => { if (event.key === "Escape") setAction(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [action]);

  function start(mode, stock) { setAction({ mode, stock }); setMessage(""); setError(""); }
  async function refresh() {
    const fresh = await accessoryFetch("/api/accessories");
    setData(fresh); setHistoryStock(""); setHistory({ movements: fresh.movements, hasMore: fresh.hasMore }); setRevision((v) => v + 1);
    router.refresh();
  }
  async function reload() {
    setLoading(true); setError("");
    try { await refresh(); setAction(null); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  async function filterHistory(stockId) {
    setLoading(true); setError("");
    try {
      const fresh = await accessoryFetch(`/api/accessories/movements${stockId ? `?stock_id=${stockId}` : ""}`);
      setHistoryStock(stockId); setHistory(fresh); setRevision((v) => v + 1); setHistoryOpen(true);
      requestAnimationFrame(() => historyPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  const pick = (stock) => (mode) => (mode === "history" ? filterHistory(stock.id) : start(mode, stock));

  const term = search.trim().toLocaleLowerCase();
  const stocks = data.stocks.filter((s) => (!type || s.accessory_type_id === type)
    && (!term || [s.accessory_type, s.brand, s.model, s.serial_number].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)));
  const summary = [
    ["พร้อมเบิกในคลัง", data.summary.available],
    ["พนักงานถืออยู่", data.summary.held],
    ["รวมทั้งบริษัท", data.summary.available + data.summary.held],
    ["นำออก/ตัดออกสะสม", data.summary.disposed],
  ];
  const toggle = (s) => setExpanded((current) => (current === s.id ? "" : s.id));
  const heldButton = (s) => (s.held_quantity > 0
    ? <button type="button" onClick={() => toggle(s)} aria-expanded={expanded === s.id} className="rounded-md px-1.5 py-0.5 font-semibold text-blue-700 hover:bg-blue-50">
      {number(s.held_quantity)} <span aria-hidden="true" className="text-xs">{expanded === s.id ? "▾" : "▸"}</span><span className="sr-only">ดูพนักงานที่ถือ</span>
    </button>
    : <span className="px-1.5 text-slate-400">0</span>);
  const issueButton = (s) => canWrite && <button className={primaryClass} onClick={() => start("issue", s)} disabled={!s.is_active || !s.available_quantity}>เบิกให้พนักงาน</button>;
  const label = (s) => <>
    <span className="font-semibold text-slate-900">{s.accessory_type}</span>
    {!s.is_active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}
  </>;

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Accessories / Stock</h1><p className="mt-1 text-sm text-blue-100">คลังกลางทั้งบริษัท · รับเข้า เบิก โอน และคืน</p></div>
      <div className="flex flex-wrap gap-2">
        {canWrite && <button className="min-h-11 rounded-lg bg-white px-4 py-2 font-semibold text-blue-900 hover:bg-blue-50" onClick={() => start("receive")}>+ รับเข้าคลัง</button>}
        <button className="min-h-11 rounded-lg border border-blue-300 px-4 py-2 text-sm disabled:opacity-50" onClick={reload} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดล่าสุด"}</button>
      </div>
    </header>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {summary.map(([name, value]) => <div key={name} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
        <dt className="text-sm text-slate-500">{name}</dt><dd className="mt-1 text-2xl font-bold">{number(value)}</dd>
      </div>)}
    </dl>

    <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:max-w-2xl sm:grid-cols-[1fr_12rem]">
          <label className="text-sm text-slate-600">ค้นหา<input className={`${inputClass} mt-1`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ประเภท ยี่ห้อ รุ่น หรือ Serial" /></label>
          <label className="text-sm text-slate-600">ประเภท<select value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} mt-1`}><option value="">ทุกประเภท</option>{data.types.map((t) => <option key={t.id} value={t.id}>{t.name}{!t.is_active ? " (Inactive)" : ""}</option>)}</select></label>
        </div>
        <Link href="/users" className="text-sm font-medium text-blue-700 hover:underline">Accessories ของพนักงาน →</Link>
      </div>

      {!stocks.length ? <div className="p-8 text-center text-slate-500">
        <p>{data.stocks.length ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการ Stock"}</p>
        {canWrite && !data.stocks.length && <button onClick={() => start("receive")} className={`${primaryClass} mt-4`}>รับเข้ารายการแรก</button>}
      </div> : <>
        {/* จอใหญ่: ตาราง */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-semibold">ประเภท</th><th className="px-4 py-2.5 font-semibold">ยี่ห้อ / รุ่น</th><th className="px-4 py-2.5 font-semibold">Serial</th>
                <th className="px-4 py-2.5 text-right font-semibold">ในคลัง</th><th className="px-4 py-2.5 text-right font-semibold">ถืออยู่</th><th className="px-4 py-2.5 text-right font-semibold">นำออก/ตัดออก</th><th className="px-4 py-2.5"><span className="sr-only">การทำงาน</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stocks.map((s) => <Fragment key={s.id}>
                <tr className="align-middle hover:bg-slate-50/60">
                  <td className="px-4 py-3">{label(s)}</td>
                  <td className="px-4 py-3 text-slate-600">{[s.brand, s.model].filter(Boolean).join(" · ") || <span className="text-slate-400">–</span>}</td>
                  <td className="max-w-48 break-all px-4 py-3 text-xs text-slate-500">{s.serial_number || <span className="text-slate-400">–</span>}</td>
                  <td className={`px-4 py-3 text-right text-base font-bold ${s.available_quantity ? "text-slate-900" : "text-amber-700"}`}>{number(s.available_quantity)}</td>
                  <td className="px-4 py-3 text-right text-base">{heldButton(s)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{number(s.disposed_quantity)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">{issueButton(s)}<RowMenu stock={s} canWrite={canWrite} onPick={pick(s)} /></div></td>
                </tr>
                {expanded === s.id && <tr><td colSpan={7} className="bg-slate-50 px-4 py-3"><p className="mb-2 text-xs font-semibold text-slate-500">พนักงานที่ถืออยู่ ({s.holders} คน)</p><Holders stock={s} holdings={data.holdings} /></td></tr>}
              </Fragment>)}
            </tbody>
          </table>
        </div>
        {/* มือถือ: การ์ด */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {stocks.map((s) => <li key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p>{label(s)}</p>
                <p className="mt-0.5 break-words text-sm text-slate-600">{[s.brand, s.model].filter(Boolean).join(" · ") || "ไม่ระบุยี่ห้อ/รุ่น"}</p>
                {s.serial_number && <p className="break-all text-xs text-slate-500">Serial: {s.serial_number}</p>}</div>
              <RowMenu stock={s} canWrite={canWrite} onPick={pick(s)} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-slate-50 py-2"><dt className="text-xs text-slate-500">ในคลัง</dt><dd className="text-lg font-bold">{number(s.available_quantity)}</dd></div>
              <div className="rounded-lg bg-slate-50 py-2"><dt className="text-xs text-slate-500">ถืออยู่</dt><dd className="text-lg">{heldButton(s)}</dd></div>
              <div className="rounded-lg bg-slate-50 py-2"><dt className="text-xs text-slate-500">นำออก/ตัดออก</dt><dd className="text-lg text-slate-600">{number(s.disposed_quantity)}</dd></div>
            </dl>
            {expanded === s.id && <div className="mt-3 rounded-lg bg-slate-50 p-2"><Holders stock={s} holdings={data.holdings} /></div>}
            {canWrite && <div className="mt-3 [&>button]:w-full">{issueButton(s)}</div>}
          </li>)}
        </ul>
      </>}
    </section>
    <p className="text-xs leading-relaxed text-slate-500">รวมทั้งบริษัท = ในคลัง + พนักงานถืออยู่ · “นำออก/ตัดออก” คือของที่ออกจากระบบโดยไม่ได้ให้พนักงาน เช่น ใช้ติดตั้ง เสีย หรือหาย</p>

    <section ref={historyPanel} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} className="text-lg font-semibold">
          <span aria-hidden="true" className="mr-1 text-slate-400">{historyOpen ? "▾" : "▸"}</span>ประวัติ
        </button>
        {historyOpen && <label className="flex items-center gap-2 text-sm text-slate-600">ของ
          <select className={`${inputClass} w-auto max-w-xs`} value={historyStock} onChange={(e) => filterHistory(e.target.value)} disabled={loading}>
            <option value="">ทุกรายการ</option>{data.stocks.map((s) => <option key={s.id} value={s.id}>{[s.accessory_type, s.brand, s.model, s.serial_number].filter(Boolean).join(" · ")}</option>)}
          </select></label>}
      </div>
      {historyOpen && <AccessoryHistory key={`history-${revision}`} initialMovements={history.movements} initialHasMore={history.hasMore} stockId={historyStock} />}
    </section>

    {action && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setAction(null); }}>
      <div role="dialog" aria-modal="true" aria-label="ฟอร์ม Accessories" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <AccessoryActionForm key={`${action.mode}-${action.stock?.id || "new"}`} {...action} className="p-5 sm:p-6"
          stocks={data.stocks} types={data.types} users={data.users} onCancel={() => setAction(null)}
          onSuccess={async () => { await refresh(); setAction(null); setMessage("บันทึกสำเร็จ อัปเดตยอด Stock และประวัติแล้ว"); }} />
      </div>
    </div>}
  </div>;
}
