"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

const MAX_LABELS = 100;

function printStatus(count, hasExistingLabel) {
  if (count === 0) return "ยังไม่เคยพิมพ์";
  if (count === 1 && hasExistingLabel) return "ติดสติ๊กเกอร์เดิมแล้ว";
  if (count === 1) return "พิมพ์แล้ว 1 ครั้ง";
  return `พิมพ์ซ้ำครั้งที่ ${count - 1} (รวม ${count} ครั้ง)`;
}

function nextPrintStatus(count) {
  return count === 0 ? "พิมพ์ครั้งแรก" : `พิมพ์ซ้ำครั้งที่ ${count}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export default function LabelManager({ initialAssets }) {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [printFilter, setPrintFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [prepared, setPrepared] = useState(null);
  const [openedPrint, setOpenedPrint] = useState(false);
  const [printConfirmationOpen, setPrintConfirmationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const existingRequestId = useRef(null);
  const afterPrintListener = useRef(null);

  useEffect(() => () => {
    if (afterPrintListener.current) {
      window.removeEventListener("afterprint", afterPrintListener.current);
    }
  }, []);

  function clearPrintListener() {
    if (!afterPrintListener.current) return;
    window.removeEventListener("afterprint", afterPrintListener.current);
    afterPrintListener.current = null;
  }

  const types = useMemo(() => [...new Set(assets.map((asset) => asset.asset_type).filter(Boolean))].sort(), [assets]);
  const statuses = useMemo(() => [...new Set(assets.map((asset) => asset.status).filter(Boolean))].sort(), [assets]);
  const locations = useMemo(() => [...new Set(assets.map((asset) => asset.location).filter(Boolean))].sort(), [assets]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return assets.filter((asset) =>
      (!term || `${asset.asset_code} ${asset.asset_name ?? ""} ${asset.owner_name ?? ""}`.toLocaleLowerCase().includes(term)) &&
      (!type || asset.asset_type === type) &&
      (!status || asset.status === status) &&
      (!location || asset.location === location) &&
      (printFilter === "all" || (printFilter === "unprinted" ? asset.print_count === 0 : asset.print_count > 0))
    );
  }, [assets, search, type, status, location, printFilter]);

  function changeSelection(next) {
    clearPrintListener();
    existingRequestId.current = null;
    setSelected(next);
    setPrepared(null);
    setOpenedPrint(false);
    setPrintConfirmationOpen(false);
    setError("");
    setMessage("");
  }

  function toggle(id) {
    changeSelection(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  function selectVisible() {
    const next = new Set(selected);
    for (const asset of filtered) {
      if (next.size >= MAX_LABELS) break;
      next.add(asset.id);
    }
    changeSelection([...next]);
  }

  async function prepare() {
    setError("");
    setMessage("");
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const chosen = assets.filter((asset) => selected.includes(asset.id));
      const labels = await Promise.all(chosen.map(async (asset) => ({
        ...asset,
        qr: await QRCode.toDataURL(asset.asset_code, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 300,
          color: { dark: "#000000", light: "#ffffff" },
        }),
      })));
      setPrepared({ requestId: crypto.randomUUID(), labels });
      setOpenedPrint(false);
      setPrintConfirmationOpen(false);
    } catch (caught) {
      console.error("Prepare Asset labels error:", caught);
      setError("สร้าง QR ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  function openPrintDialog() {
    if (!prepared || busy || openedPrint) return;
    setError("");
    setMessage("");
    setPrintConfirmationOpen(false);
    clearPrintListener();
    const listener = () => {
      clearPrintListener();
      setPrintConfirmationOpen(true);
    };
    afterPrintListener.current = listener;
    window.addEventListener("afterprint", listener, { once: true });
    setOpenedPrint(true);
    window.requestAnimationFrame(() => {
      try {
        window.print();
      } catch (caught) {
        console.error("Open Asset label print dialog error:", caught);
        clearPrintListener();
        setOpenedPrint(false);
        setError("เปิดหน้าพิมพ์ไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    });
  }

  function cancelPrint() {
    clearPrintListener();
    setPrintConfirmationOpen(false);
    setOpenedPrint(false);
    setError("");
    setMessage("ยังไม่บันทึกประวัติการพิมพ์ สามารถเปิดหน้าพิมพ์อีกครั้งได้");
  }

  function cancelPrepared() {
    clearPrintListener();
    setPrepared(null);
    setOpenedPrint(false);
    setPrintConfirmationOpen(false);
  }

  async function confirmPrinted() {
    if (!prepared || !openedPrint) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/asset-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: prepared.requestId,
          assetIds: prepared.labels.map((asset) => asset.id),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      const updated = new Map(result.assets.map((asset) => [asset.id, asset]));
      setAssets((current) => current.map((asset) => updated.has(asset.id)
        ? { ...asset, ...updated.get(asset.id) }
        : asset));
      setMessage(`บันทึกการพิมพ์ ${prepared.labels.length} Asset แล้ว`);
      clearPrintListener();
      setPrintFilter("all");
      setSelected([]);
      setPrepared(null);
      setOpenedPrint(false);
      setPrintConfirmationOpen(false);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function markExisting() {
    const chosen = assets.filter((asset) => selected.includes(asset.id));
    if (chosen.length === 0 || chosen.some((asset) => asset.print_count > 0)) return;
    if (!window.confirm(`ยืนยันว่า Asset ${chosen.length} รายการมีสติ๊กเกอร์ติดอยู่แล้ว?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      existingRequestId.current ||= crypto.randomUUID();
      const response = await fetch("/api/asset-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: existingRequestId.current,
          assetIds: chosen.map((asset) => asset.id),
          source: "existing",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      const updated = new Map(result.assets.map((asset) => [asset.id, asset]));
      setAssets((current) => current.map((asset) => updated.has(asset.id)
        ? { ...asset, ...updated.get(asset.id) }
        : asset));
      setMessage(`บันทึกว่าสติ๊กเกอร์เดิมติดอยู่แล้ว ${chosen.length} Asset`);
      setSelected([]);
      setPrepared(null);
      setOpenedPrint(false);
      setPrintConfirmationOpen(false);
      clearPrintListener();
      existingRequestId.current = null;
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedVisible = filtered.filter((asset) => selected.includes(asset.id)).length;

  return (
    <>
      <style>{`
        @media print {
          @page { size: 40mm 30mm; margin: 0; }
          body { display: block !important; min-width: 0; margin: 0 !important; background: #fff !important; }
          body > :not(.app-content) { display: none !important; }
          .app-content { padding: 0 !important; width: 100% !important; }
          .app-content main, .app-content main > div { margin: 0 !important; padding: 0 !important; max-width: none !important; background: #fff !important; }
          .app-content main > div > header, .labels-page-ui { display: none !important; }
          .label-print-area { display: block; }
          .label-print-page { width: 40mm; height: 30mm; break-after: page; }
          .label-print-page:last-child { break-after: auto; }
          .asset-label { border: 0; }
          .asset-label, .asset-label img { print-color-adjust: exact; }
        }
      `}</style>
      <div className="labels-page-ui space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">เลือก Asset ที่ต้องการพิมพ์</h2>
              <p className="mt-1 text-sm text-slate-500">เลือกได้สูงสุด {MAX_LABELS} รายการต่อชุด สติ๊กเกอร์ม้วนขนาด 40 × 30 มม. หนึ่ง Asset ต่อหนึ่งดวง</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">เลือกแล้ว {selected.length} รายการ</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-medium text-slate-700">ค้นหารหัส ชื่อ Asset หรือ Owner
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="เช่น F1-NB-041" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" />
            </label>
            <label className="text-sm font-medium text-slate-700">Asset Type
              <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="">ทุกประเภท</option>{types.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Asset Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="">ทุกสถานะ</option>{statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Location
              <select value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="">ทุก Location</option>{locations.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">สถานะการพิมพ์
              <select value={printFilter} onChange={(event) => setPrintFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="all">ทั้งหมด</option><option value="unprinted">ยังไม่เคยพิมพ์</option><option value="printed">เคยพิมพ์แล้ว</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={selectVisible} disabled={filtered.length === 0 || selected.length >= MAX_LABELS} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">เลือกจากผลค้นหา</button>
            <button type="button" onClick={() => changeSelection([])} disabled={selected.length === 0} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">ล้างรายการที่เลือก</button>
            <span className="text-sm text-slate-500">พบ {filtered.length} รายการ · เลือกในผลค้นหา {selectedVisible} รายการ</span>
          </div>

          <div className="mt-4 max-h-[550px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>
                <th className="px-3 py-3">เลือก</th><th className="px-3 py-3">Asset Code</th><th className="px-3 py-3">ชื่อ / ประเภท</th><th className="px-3 py-3">Asset Owner</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">ประวัติพิมพ์</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((asset) => <tr key={asset.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(asset.id)} disabled={!selected.includes(asset.id) && selected.length >= MAX_LABELS} onChange={() => toggle(asset.id)} aria-label={`เลือก ${asset.asset_code}`} className="h-5 w-5 accent-blue-600" /></td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-800">{asset.asset_code}</td>
                  <td className="px-3 py-3"><span className="font-medium">{asset.asset_name || "-"}</span><span className="block text-xs text-slate-500">{asset.asset_type || "-"}</span></td>
                  <td className="px-3 py-3">{asset.owner_name || "ยังไม่ระบุ"}</td>
                  <td className="px-3 py-3">{asset.location || "-"}</td>
                  <td className="px-3 py-3"><span className={asset.print_count > 0 ? "font-medium text-emerald-700" : "text-slate-500"}>{printStatus(asset.print_count, asset.has_existing_label)}</span><span className="block text-xs text-slate-500">{formatDate(asset.last_printed_at)}</span></td>
                </tr>)}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">ไม่พบ Asset ตามตัวกรอง</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={prepare} disabled={selected.length === 0 || busy} className="min-h-11 rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy && !prepared ? "กำลังสร้าง QR..." : `เตรียมพิมพ์ ${selected.length} รายการ`}</button>
            <button type="button" onClick={markExisting} disabled={selected.length === 0 || busy || selected.some((id) => assets.find((asset) => asset.id === id)?.print_count > 0)} className="min-h-11 rounded-lg border border-emerald-300 px-5 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">ติดสติ๊กเกอร์เดิมแล้ว</button>
          </div>
        </section>

        {prepared && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">ตัวอย่างสติ๊กเกอร์</h2>
          <p className="mt-1 text-sm text-slate-500">QR เป็นข้อความ Asset Code เท่านั้น สติ๊กเกอร์พิมพ์เฉพาะรหัสและ QR; ชื่อ Asset Owner แสดงบนหน้าเว็บเท่านั้น</p>
          <p className="mt-1 text-sm text-slate-500">ตอนสั่งพิมพ์ให้เลือกกระดาษ 40 × 30 มม. ตั้งสเกล 100% และปิดหัว/ท้ายกระดาษ</p>
          <div className="mt-4 flex max-h-80 flex-wrap gap-3 overflow-auto rounded-xl bg-slate-100 p-4">
            {prepared.labels.map((asset) => <div key={asset.id} className="text-center">
              <div className="asset-label"><strong>{asset.asset_code}</strong><Image src={asset.qr} alt={`QR ${asset.asset_code}`} width={300} height={300} unoptimized /></div>
              <p className="mt-1 max-w-[40mm] text-xs text-slate-600">Owner: {asset.owner_name || "ยังไม่ระบุ"}</p>
              <p className="mt-1 text-xs font-medium text-slate-700">{nextPrintStatus(asset.print_count)}</p>
            </div>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={openPrintDialog} disabled={busy || openedPrint} className="min-h-11 rounded-lg bg-slate-900 px-5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{openedPrint ? "เปิดหน้าพิมพ์แล้ว" : "เปิดหน้าพิมพ์"}</button>
            {openedPrint && !printConfirmationOpen && <button type="button" onClick={() => { clearPrintListener(); setPrintConfirmationOpen(true); }} disabled={busy} className="min-h-11 rounded-lg border border-emerald-300 px-5 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">ยืนยันผลการพิมพ์</button>}
            <button type="button" onClick={cancelPrepared} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-5 font-medium hover:bg-slate-50 disabled:opacity-50">ยกเลิกชุดนี้</button>
          </div>
          {openedPrint && <p className="mt-3 text-sm text-amber-800">เมื่อปิดหน้าพิมพ์ ระบบจะถามผลการพิมพ์ หากหน้าต่างยืนยันไม่ขึ้นให้กด “ยืนยันผลการพิมพ์”</p>}
        </section>}
        {printConfirmationOpen && prepared && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="label-print-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="label-print-confirm-title" className="text-lg font-semibold text-slate-900">พิมพ์สติ๊กเกอร์สำเร็จหรือไม่?</h2>
            <p className="mt-2 text-sm text-slate-600">ตรวจสติ๊กเกอร์ {prepared.labels.length} Asset ก่อนยืนยัน ระบบจะเพิ่มประวัติและจำนวนครั้งพิมพ์ทันที เฉพาะรายการที่พิมพ์สำเร็จ</p>
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={cancelPrint} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">ยังไม่ได้พิมพ์ / ยกเลิก</button>
              <button type="button" onClick={confirmPrinted} disabled={busy} className="min-h-11 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังบันทึก..." : "พิมพ์สำเร็จ · บันทึกประวัติ"}</button>
            </div>
          </section>
        </div>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      </div>

      <div className="label-print-area" aria-hidden="true">
        {prepared && prepared.labels.map((asset) =>
          <div key={asset.id} className="label-print-page">
            <div className="asset-label"><strong>{asset.asset_code}</strong><Image src={asset.qr} alt="" width={300} height={300} unoptimized /></div>
          </div>
        )}
      </div>
    </>
  );
}
