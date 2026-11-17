"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { reportCsv } from "@/lib/report-csv";

const normalize = (value) => String(value ?? "").toLocaleLowerCase("th");

export default function ReportTable({
  rows,
  columns,
  filename,
  filterField,
  filterLabel,
  filterOptions,
  linkField,
  linkLabel,
  linkTargetField,
  linkPrefix,
  linkSuffix = "",
  // ลิงก์เสริมในคอลัมน์ "ทำต่อ" เปิดแท็บใหม่ เช่น PDF ใบคืนทรัพย์สิน
  extraLinkLabel,
  extraLinkPrefix,
  extraLinkSuffix = "",
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesFilter = !filter || row[filterField] === filter;
    const matchesSearch = !search || Object.values(row).some((value) =>
      normalize(value).includes(normalize(search)));
    return matchesFilter && matchesSearch;
  }), [filter, filterField, rows, search]);

  function download() {
    const blob = new Blob([reportCsv(visibleRows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function rowHref(row) {
    return `${linkPrefix}${row[linkTargetField]}${linkSuffix}`;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto] md:items-end">
        <label className="text-sm font-medium">
          ค้นหา
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาจากข้อมูลในรายงาน" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        </label>
        {filterOptions?.length > 0 && (
          <label className="text-sm font-medium">
            {filterLabel}
            <select value={filter} onChange={(event) => setFilter(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
              <option value="">ทั้งหมด</option>
              {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={!visibleRows.length} onClick={download}
          className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          ดาวน์โหลด CSV ({visibleRows.length})
        </button>
      </div>
      <p className="text-sm text-slate-500">แสดง {visibleRows.length.toLocaleString("th-TH")} จาก {rows.length.toLocaleString("th-TH")} รายการ</p>
      {!visibleRows.length ? (
        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{rows.length ? "ไม่พบข้อมูลที่ตรงกับตัวกรอง" : "ไม่มีรายการในรายงาน"}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-slate-600">
              {columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 font-semibold">{column.label}</th>)}
              {linkField && <th className="px-3 py-3">ทำต่อ</th>}
            </tr></thead>
            <tbody>{visibleRows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                {columns.map((column) => (
                  <td key={column.key} className="max-w-[360px] whitespace-pre-wrap break-words px-3 py-3 align-top">
                    {column.key === linkField
                      ? <Link className="font-semibold text-blue-700 hover:underline" href={rowHref(row)}>{row[column.key] || "-"}</Link>
                      : row[column.key] ?? "-"}
                  </td>
                ))}
                {linkField && <td className="whitespace-nowrap px-3 py-3 align-top">
                  <Link className="font-semibold text-blue-700 hover:underline" href={rowHref(row)}>{linkLabel}</Link>
                  {extraLinkLabel && (
                    <a className="mt-1 block font-semibold text-slate-700 hover:underline" target="_blank" rel="noopener"
                      href={`${extraLinkPrefix}${row[linkTargetField]}${extraLinkSuffix}`}>{extraLinkLabel}</a>
                  )}
                </td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
