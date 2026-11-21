"use client";

import Link from "next/link";
import { useState } from "react";
import { readApiResponse } from "@/lib/client-api";

const MAX_FILES = 200;

const STATUS = {
  ready: ["พร้อมบันทึก", "bg-blue-50 text-blue-800"],
  saved: ["บันทึกแล้ว", "bg-emerald-50 text-emerald-800"],
  not_found: ["ไม่พบ Asset ที่มี Serial นี้", "bg-amber-50 text-amber-900"],
  ambiguous: ["Serial นี้ตรงกับหลาย Asset (ข้าม)", "bg-amber-50 text-amber-900"],
  no_serial: ["ไฟล์ไม่มี Serial", "bg-amber-50 text-amber-900"],
  manual_invalid: ["เลือก Asset ไม่ได้", "bg-red-50 text-red-800"],
  duplicate: ["Serial ซ้ำกับไฟล์อื่น ใช้ไฟล์หลังสุดแทน (ข้าม)", "bg-slate-100 text-slate-700"],
  invalid: ["ไม่ใช่ไฟล์จากสคริปต์ (ข้าม)", "bg-red-50 text-red-800"],
  failed: ["บันทึกไม่สำเร็จ", "bg-red-50 text-red-800"],
};

// แถวที่ผู้ใช้เลือก Asset เองได้ (จับคู่ด้วย Serial ไม่ได้)
const PICKABLE = ["not_found", "no_serial", "manual_invalid"];

const CHANGE_LABELS = { brand: "Brand", model: "Model", serialNumber: "Serial" };

async function readFiles(fileList) {
  const files = [...fileList].filter((file) => file.name.toLowerCase().endsWith(".json"));
  return Promise.all(files.slice(0, MAX_FILES).map(async (file) => ({
    fileName: file.name,
    text: file.size > 20000 ? "" : await file.text(),
  })));
}

function Changes({ changes }) {
  const entries = Object.entries(changes || {});
  if (entries.length === 0) return <span className="text-slate-400">ไม่เปลี่ยน</span>;
  return (
    <ul className="space-y-0.5">
      {entries.map(([name, { from, to }]) => (
        <li key={name}>
          <span className="font-medium text-slate-700">{CHANGE_LABELS[name]}:</span>{" "}
          {from ? <><span className="text-slate-400 line-through">{from}</span> → </> : <span className="text-emerald-700">เติม </span>}
          <span className="text-slate-900">{to}</span>
        </li>
      ))}
    </ul>
  );
}

function ManualPick({ item, index, busy, onPick }) {
  const [code, setCode] = useState(item.manualCode || "");
  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
      onSubmit={(event) => { event.preventDefault(); onPick(index, code); }}
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="รหัส Asset เช่น AMZAP26-NB-042"
        aria-label={`รหัส Asset สำหรับไฟล์ ${item.fileName}`}
        maxLength={50}
        className="min-h-9 w-56 rounded-lg border border-slate-300 px-2 text-xs"
      />
      <button type="submit" disabled={busy || !code.trim()}
        className="min-h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs font-medium text-blue-800 disabled:opacity-50">
        ใช้ Asset นี้
      </button>
    </form>
  );
}

export default function SpecsImport() {
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [manual, setManual] = useState({});
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function send(method, payload, options) {
    return readApiResponse(await fetch("/api/assets/machine-specs", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload, manual: options.manual, overwriteBrandModel: options.overwrite }),
    }));
  }

  // ตรวจไฟล์ใหม่ทุกครั้งที่เปลี่ยนไฟล์ / Asset ที่เลือกเอง / ช่องติ๊กเขียนทับ
  async function preview(selected, options) {
    setBusy(true);
    setError("");
    try {
      const data = await send("POST", selected, options);
      setFiles(selected);
      setItems(data.items);
      setManual(options.manual);
      setOverwrite(options.overwrite);
      return true;
    } catch (e) {
      setError(e.message || "ตรวจไฟล์ไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function choose(fileList) {
    if (busy) return;
    setMessage("");
    setError("");
    setSaved(false);
    const selected = await readFiles(fileList);
    if (selected.length === 0) {
      setError("ไม่พบไฟล์ .json ในที่เลือก");
      return;
    }
    const ok = await preview(selected, { manual: {}, overwrite });
    if (!ok) { setFiles([]); setItems([]); }
    else if (fileList.length > MAX_FILES) setMessage(`เลือกได้ครั้งละ ${MAX_FILES} ไฟล์ ระบบใช้ ${MAX_FILES} ไฟล์แรก`);
  }

  function pick(index, code) {
    if (busy || saved) return;
    const next = { ...manual };
    if (code.trim()) next[index] = code.trim();
    else delete next[index];
    preview(files, { manual: next, overwrite });
  }

  function toggleOverwrite(checked) {
    if (busy || saved || files.length === 0) { setOverwrite(checked); return; }
    preview(files, { manual, overwrite: checked });
  }

  async function saveAll() {
    if (busy) return;
    const readyCount = items.filter((item) => item.status === "ready").length;
    if (!window.confirm(`บันทึกสเปกให้ ${readyCount} เครื่อง?\nช่อง Technical ที่ไม่มีในไฟล์จะคงค่าเดิมไว้`)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = await send("PUT", files, { manual, overwrite });
      setItems(data.items);
      setSaved(true);
      setMessage(`บันทึกแล้ว ${data.saved} เครื่อง`);
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFiles([]);
    setItems([]);
    setManual({});
    setMessage("");
    setError("");
    setSaved(false);
  }

  const readyCount = items.filter((item) => item.status === "ready").length;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>รันสคริปต์จาก USB บนเครื่องของผู้ใช้ สคริปต์จะบันทึกไฟล์ <code className="rounded bg-slate-100 px-1">Serial.json</code> ไว้ในโฟลเดอร์ <code className="rounded bg-slate-100 px-1">specs</code> ข้างสคริปต์</li>
        <li>นำ USB มาที่เครื่อง IT แล้วเลือกหรือลากไฟล์ทั้งหมดจากโฟลเดอร์ specs มาวางด้านล่าง</li>
        <li>ตรวจรายการที่จับคู่ได้ ไฟล์ที่หา Asset ไม่พบให้พิมพ์รหัส Asset เอง แล้วกด &quot;บันทึกทั้งหมด&quot;</li>
      </ol>

      <label
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"}`}
      >
        <span className="font-semibold text-blue-800">{busy ? "กำลังตรวจไฟล์..." : "เลือกไฟล์ .json หรือลากมาวางที่นี่"}</span>
        <span className="mt-1 text-sm text-slate-500">เลือกได้หลายไฟล์พร้อมกัน (ไม่เกิน {MAX_FILES} ไฟล์)</span>
        <input type="file" accept=".json,application/json" multiple disabled={busy} className="sr-only"
          onChange={(event) => { choose(event.target.files); event.target.value = ""; }} />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <input type="checkbox" checked={overwrite} disabled={busy || saved}
          onChange={(event) => toggleOverwrite(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="font-semibold text-slate-800">เขียนทับ Brand / Model ด้วยค่าจากเครื่อง</span>
          <span className="block text-slate-600">ถ้าไม่ติ๊ก จะเติมให้เฉพาะ Asset ที่ช่องยังว่าง · Serial เติมให้เฉพาะตอนว่างเสมอ ไม่เขียนทับ</span>
        </span>
      </label>

      {message && <p className="text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {items.length > 0 && <>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">ไฟล์</th>
                <th className="px-3 py-2 font-semibold">Serial</th>
                <th className="px-3 py-2 font-semibold">Asset</th>
                <th className="px-3 py-2 font-semibold">Brand / Model / Serial</th>
                <th className="px-3 py-2 font-semibold">ข้อมูล</th>
                <th className="px-3 py-2 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const [label, tone] = STATUS[item.status] || [item.status, "bg-slate-100 text-slate-700"];
                const canPick = !saved && (PICKABLE.includes(item.status) || (item.manualCode && item.status === "ready"));
                return (
                  <tr key={`${item.fileName}-${index}`} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs">{item.fileName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.serialNumber || "-"}</td>
                    <td className="px-3 py-2">
                      {item.asset ? (
                        <Link href={`/assets/${item.asset.id}`} target="_blank" className="font-semibold text-blue-700 hover:underline">
                          {item.asset.asset_code}
                        </Link>
                      ) : item.assets?.length ? item.assets.map((asset) => asset.asset_code).join(", ") : "-"}
                      {item.asset && <span className="block text-xs text-slate-500">{item.asset.asset_name}</span>}
                      {item.manualCode && item.asset && <span className="block text-xs text-amber-700">เลือกเอง</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.changes ? <Changes changes={item.changes} />
                        : item.machine && (item.machine.brand || item.machine.model)
                          ? <span className="text-slate-500">{[item.machine.brand, item.machine.model].filter(Boolean).join(" ")}</span>
                          : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {item.values ? [item.values.hostname, item.values.cpu, item.values.officeProduct].filter(Boolean).join(" · ") || "-" : "-"}
                      {item.fieldCount > 0 && <span className="block text-slate-400">{item.fieldCount} ช่อง</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>
                      {item.error && ["failed", "manual_invalid"].includes(item.status) && <span className="mt-1 block text-xs text-red-700">{item.error}</span>}
                      {item.status === "not_found" && !item.manualCode && <span className="mt-1 block text-xs text-slate-500">พิมพ์รหัส Asset ที่ Serial ยังว่าง ระบบจะเติม Serial ให้</span>}
                      {item.status === "no_serial" && <span className="mt-1 block text-xs text-slate-500">พิมพ์รหัส Asset เพื่อบันทึกสเปก</span>}
                      {canPick && <ManualPick key={item.manualCode || ""} item={item} index={index} busy={busy} onPick={pick} />}
                      {canPick && item.manualCode && (
                        <button type="button" disabled={busy} onClick={() => pick(index, "")}
                          className="mt-1 text-xs text-slate-500 underline disabled:opacity-50">
                          ยกเลิกที่เลือก
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!saved && (
            <button type="button" onClick={saveAll} disabled={busy || readyCount === 0}
              className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              บันทึกทั้งหมด ({readyCount} เครื่อง)
            </button>
          )}
          <button type="button" onClick={reset} disabled={busy}
            className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {saved ? "นำเข้าชุดใหม่" : "ล้างรายการ"}
          </button>
        </div>
      </>}
    </section>
  );
}
