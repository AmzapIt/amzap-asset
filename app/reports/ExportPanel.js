"use client";

import { useMemo, useState } from "react";
import { filenameFromContentDisposition } from "@/lib/export-filename";
import EmployeePicker from "@/app/components/EmployeePicker";

const HANDOVER_KINDS = [
  "พนักงานใหม่",
  "เปลี่ยนอุปกรณ์",
  "รับเพิ่ม",
  "คืนอุปกรณ์",
];

const HANDOVER_FIELDS = [
  ["documentNo", "เลขที่เอกสาร", 60],
  ["date", "วันที่ส่งมอบ", 10],
  ["location", "สถานที่ส่งมอบ", 100],
  ["purpose", "วัตถุประสงค์การใช้งาน", 150],
  ["startDate", "วันที่เริ่มครอบครอง", 10],
  ["notes", "หมายเหตุ / ตำหนิอุปกรณ์", 350],
  ["deliveredBy", "ผู้ส่งมอบ / ฝ่าย IT", 100],
  ["approvedBy", "ผู้อนุมัติ", 100],
  ["itNotes", "หมายเหตุฝ่าย IT", 350],
];

const normalize = (value) => String(value ?? "").toLowerCase().trim();

function matchesAsset(asset, search) {
  const keyword = normalize(search);

  if (!keyword) return true;

  // ค้นจากผู้ครอบครองปัจจุบันเท่านั้น ไม่ใช้ Asset Owner เดิม เพราะอาจทำให้
  // Asset ที่คืนแล้วกลับมาติดผลค้นหาของพนักงานคนเดิม
  return [
    asset.asset_code,
    asset.legacy_asset_codes,
    asset.asset_name,
    asset.serial_number,
    asset.current_holder,
  ].some((value) => normalize(value).includes(keyword));
}

export default function ExportPanel({ accessories, assets, users, view }) {
  // รายงานทั่วไปและใบรับมอบต้องมี selection คนละชุด เพื่อไม่ให้ Asset
  // ที่เลือกจากรายงานทั่วไปค้างไปอยู่ในเอกสารของพนักงานอีกคน
  const [reportSelected, setReportSelected] = useState([]);
  const [handoverSelected, setHandoverSelected] = useState([]);
  const [reportSearch, setReportSearch] = useState("");
  const [handoverSearch, setHandoverSearch] = useState("");
  const [status, setStatus] = useState("");
  const [holder, setHolder] = useState("");
  const [recipient, setRecipient] = useState("");
  const [form, setForm] = useState({ kind: "พนักงานใหม่" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const statuses = useMemo(
    () => [...new Set(assets.map((asset) => asset.status).filter(Boolean))].sort(),
    [assets],
  );

  const reportRows = useMemo(
    () =>
      assets.filter((asset) => {
        const holderMatches =
          !holder ||
          (holder === "unassigned"
            ? asset.current_holder_id == null
            : asset.current_holder_id === holder);

        return (
          (!status || asset.status === status) &&
          holderMatches &&
          matchesAsset(asset, reportSearch)
        );
      }),
    [assets, holder, reportSearch, status],
  );

  const recipientAssets = useMemo(
    () =>
      recipient
        ? assets.filter((asset) => asset.current_holder_id === recipient)
        : [],
    [assets, recipient],
  );

  const recipientAccessories = useMemo(
    () =>
      recipient
        ? accessories.filter((accessory) => accessory.user_id === recipient)
        : [],
    [accessories, recipient],
  );

  const handoverRows = useMemo(() => {
    if (!recipient) return [];

    return assets.filter((asset) => {
      // ใบคืนแสดงเฉพาะของที่พนักงานถืออยู่ ส่วนเอกสารรับ/เปลี่ยน/รับเพิ่ม
      // เลือกได้จากของว่างและของที่พนักงานคนเดิมถืออยู่เท่านั้น
      const holderMatches =
        form.kind === "คืนอุปกรณ์"
          ? asset.current_holder_id === recipient
          : asset.current_holder_id == null ||
            asset.current_holder_id === recipient;

      return holderMatches && matchesAsset(asset, handoverSearch);
    });
  }, [assets, form.kind, handoverSearch, recipient]);

  async function download(format, ids) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          ids,
          recipientId: recipient,
          form,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "ไม่สามารถสร้างเอกสารได้");
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromContentDisposition(
        response.headers.get("Content-Disposition"),
        `AMZAP-${format}.${format === "xlsx" ? "xlsx" : "pdf"}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError.message || "ไม่สามารถสร้างเอกสารได้");
    } finally {
      setBusy(false);
    }
  }

  function changeReportFilter(setter, value) {
    setter(value);
    setReportSelected([]);
  }

  function changeRecipient(value) {
    setRecipient(value);
    setHandoverSelected([]);
    setHandoverSearch("");
    setError("");
  }

  function changeHandoverKind(kind) {
    setForm((current) => ({ ...current, kind }));
    setHandoverSelected([]);
    setHandoverSearch("");
    setError("");
  }

  function toggleHandover(assetId, checked) {
    setHandoverSelected((current) => {
      if (!checked) return current.filter((id) => id !== assetId);
      if (current.includes(assetId) || current.length >= 7) return current;
      return [...current, assetId];
    });
  }

  return (
    <div className="space-y-6">
      {view === "assets" && (
        <section className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="font-semibold">
            1. ส่งออกรายการ Asset ({reportSelected.length} รายการ)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            ค้นหาและกรองด้วยผู้ครอบครองปัจจุบัน ข้อมูลจะถูกอ่านจากฐานข้อมูลอีกครั้งก่อนสร้างไฟล์
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_280px]">
          <label className="text-sm font-medium">
            ค้นหา
            <input
              aria-label="ค้นหาทรัพย์สิน"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              value={reportSearch}
              onChange={(event) =>
                changeReportFilter(setReportSearch, event.target.value)
              }
              placeholder="Asset Code, ชื่อ, Serial หรือผู้ครอบครองปัจจุบัน"
            />
          </label>

          <label className="text-sm font-medium">
            สถานะ
            <select
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-500"
              value={status}
              onChange={(event) =>
                changeReportFilter(setStatus, event.target.value)
              }
            >
              <option value="">ทุกสถานะ</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <EmployeePicker
            label="ผู้ครอบครองปัจจุบัน"
            users={[{ id: "unassigned", full_name: "ยังไม่มีผู้ครอบครอง" }, ...users]}
            value={holder}
            onChange={(id) => changeReportFilter(setHolder, id)}
            emptyLabel="ทุกคน"
          />
        </div>

        <p className="text-sm text-slate-500">
          พบ {reportRows.length} รายการ · เมื่อเปลี่ยนตัวกรอง ระบบจะล้างรายการที่เลือกเพื่อป้องกันข้อมูลเก่าติดไปในไฟล์
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap sm:gap-4">
          <button
            className="font-medium text-blue-700 underline"
            onClick={() => setReportSelected(reportRows.map((asset) => asset.id))}
            type="button"
          >
            เลือกผลค้นหาทั้งหมด ({reportRows.length})
          </button>
          <button
            className="font-medium text-slate-600 underline"
            onClick={() => setReportSelected([])}
            type="button"
          >
            ล้างการเลือก
          </button>
        </div>

        <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3">เลือก</th>
                <th className="p-3">Asset Code</th>
                <th className="p-3">ชื่อทรัพย์สิน</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">Asset Owner</th>
                <th className="p-3">ผู้ครอบครองปัจจุบัน</th>
                <th className="p-3">แหล่งข้อมูล</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((asset) => (
                <tr key={asset.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`เลือก ${asset.asset_code}`}
                      checked={reportSelected.includes(asset.id)}
                      onChange={(event) =>
                        setReportSelected((current) =>
                          event.target.checked
                            ? [...current, asset.id]
                            : current.filter((id) => id !== asset.id),
                        )
                      }
                    />
                  </td>
                  <td className="p-3 font-medium">
                    {asset.asset_code}
                    {asset.legacy_asset_codes && (
                      <span className="block text-xs font-normal text-amber-700">
                        เดิม: {asset.legacy_asset_codes}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{asset.asset_name || "-"}</td>
                  <td className="p-3">{asset.status || "-"}</td>
                  <td className="p-3">{asset.owner_name || "-"}</td>
                  <td className="p-3">{asset.current_holder || "-"}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {asset.holder_source || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reportRows.length && (
            <p className="p-6 text-center text-slate-500">ไม่พบรายการ</p>
          )}
        </div>

        <div className="grid gap-3 sm:flex sm:flex-wrap">
          <button
            disabled={busy || !reportSelected.length}
            className="rounded-lg bg-emerald-700 px-4 py-3 text-white disabled:opacity-40"
            onClick={() => download("xlsx", reportSelected)}
            type="button"
          >
            Export Excel
          </button>
          <button
            disabled={busy || !reportSelected.length}
            className="rounded-lg bg-blue-700 px-4 py-3 text-white disabled:opacity-40"
            onClick={() => download("pdf", reportSelected)}
            type="button"
          >
            Export PDF รายการ Asset
          </button>
        </div>
        </section>
      )}

      {view === "handover" && (
        <section className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="font-semibold">2. ใบรับมอบทรัพย์สินตามแบบ AMZAP</h2>
          <p className="mt-1 text-sm text-slate-500">
            รายการในส่วนนี้แยกจากรายงานทั่วไป เปลี่ยนพนักงานหรือประเภทเอกสารแล้วระบบจะล้าง Asset ที่เลือกทันที
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EmployeePicker
            label="ผู้รับมอบ"
            users={users}
            value={recipient}
            onChange={changeRecipient}
            required
          />

          <label className="text-sm font-medium">
            ประเภทการรับมอบ
            <select
              className="mt-1 block w-full rounded-lg border border-slate-200 p-3"
              value={form.kind}
              onChange={(event) => changeHandoverKind(event.target.value)}
            >
              {HANDOVER_KINDS.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
        </div>

        {recipient && (
          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-800">
                  เลือก Asset สำหรับใบนี้ ({handoverSelected.length}/7)
                </h3>
                <p className="text-sm text-slate-500">
                  พนักงานถือ Asset อยู่ {recipientAssets.length} รายการ และ
                  Accessory อยู่ {recipientAccessories.length} รายการ
                </p>
              </div>
              <button
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-40"
                disabled={!recipientAssets.length}
                onClick={() =>
                  setHandoverSelected(
                    recipientAssets.slice(0, 7).map((asset) => asset.id),
                  )
                }
                type="button"
              >
                เลือก Asset ปัจจุบันของพนักงาน
              </button>
            </div>

            <input
              aria-label="ค้นหา Asset สำหรับใบรับมอบ"
              className="w-full rounded-lg border border-slate-200 bg-white p-3 outline-none focus:border-blue-500"
              value={handoverSearch}
              onChange={(event) => {
                setHandoverSearch(event.target.value);
                setHandoverSelected([]);
              }}
              placeholder="ค้นหา Asset Code, ชื่อ หรือ Serial"
            />

            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-[680px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-3">เลือก</th>
                    <th className="p-3">Asset Code</th>
                    <th className="p-3">ชื่อทรัพย์สิน</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3">ผู้ครอบครองปัจจุบัน</th>
                  </tr>
                </thead>
                <tbody>
                  {handoverRows.map((asset) => {
                    const checked = handoverSelected.includes(asset.id);
                    const limitReached =
                      !checked && handoverSelected.length >= 7;

                    return (
                      <tr key={asset.id} className="border-t border-slate-100">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            aria-label={`เลือก ${asset.asset_code} สำหรับใบรับมอบ`}
                            checked={checked}
                            disabled={limitReached}
                            onChange={(event) =>
                              toggleHandover(asset.id, event.target.checked)
                            }
                          />
                        </td>
                        <td className="p-3 font-medium">{asset.asset_code}</td>
                        <td className="p-3">{asset.asset_name || "-"}</td>
                        <td className="p-3">{asset.status || "-"}</td>
                        <td className="p-3">{asset.current_holder || "ว่าง"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!handoverRows.length && (
                <p className="p-6 text-center text-slate-500">
                  ไม่พบ Asset ที่เลือกใช้กับเอกสารประเภทนี้ได้
                </p>
              )}
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-slate-800">
                  Accessory ที่จะเพิ่มในใบรับมอบอัตโนมัติ
                </h4>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-emerald-700">
                  {recipientAccessories.length} รายการ
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                แสดงเฉพาะรายการที่พนักงานยังไม่ได้คืน และไม่รวมในโควตา Asset สูงสุด 7 รายการ
              </p>

              {recipientAccessories.length ? (
                <div className="mt-3 overflow-x-auto rounded-lg border border-emerald-100 bg-white">
                  <table className="min-w-[620px] w-full text-left text-sm">
                    <thead className="bg-emerald-50 text-slate-700">
                      <tr>
                        <th className="p-3">Accessory</th>
                        <th className="p-3">Brand / Model</th>
                        <th className="p-3">Serial Number</th>
                        <th className="p-3 text-right">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipientAccessories.map((accessory) => (
                        <tr
                          key={accessory.id}
                          className="border-t border-emerald-100"
                        >
                          <td className="p-3 font-medium">
                            {accessory.accessory_type}
                          </td>
                          <td className="p-3">
                            {[accessory.brand, accessory.model]
                              .filter(Boolean)
                              .join(" / ") || "-"}
                          </td>
                          <td className="p-3">
                            {accessory.serial_number || "-"}
                          </td>
                          <td className="p-3 text-right">
                            {accessory.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-emerald-200 bg-white p-4 text-center text-sm text-slate-500">
                  พนักงานคนนี้ไม่มี Accessory ที่กำลังถืออยู่
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {HANDOVER_FIELDS.map(([key, label, max]) => (
            <label key={key} className="text-sm font-medium">
              {label}
              <input
                className="mt-1 block w-full rounded-lg border border-slate-200 p-3"
                type={key === "date" || key === "startDate" ? "date" : "text"}
                maxLength={max}
                value={form[key] ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <button
          disabled={
            busy ||
            !recipient ||
            (!handoverSelected.length && !recipientAccessories.length) ||
            handoverSelected.length > 7
          }
          className="rounded-lg bg-slate-900 px-4 py-3 text-white disabled:opacity-40"
          onClick={() => download("handover", handoverSelected)}
          type="button"
        >
          ดาวน์โหลด PDF ใบรับมอบ
        </button>
        </section>
      )}

      <p role="status" className="text-red-700">
        {busy ? "กำลังสร้างเอกสาร…" : error}
      </p>
    </div>
  );
}
