"use client";

import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/client-api";

const STORAGE_KEY = "amzap:asset-subtypes:type";
const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

function readStoredType() {
  try { return window.localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}

function storeType(value) {
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* ไม่จำก็ใช้งานได้ */ }
}

// จัดการประเภทย่อยทีละ Asset Type: ตารางแสดงอย่างเดียว แก้ผ่านกล่อง เพิ่ม / แก้ไข
// ลบไม่ได้ ให้ปิดใช้งานแทน เพื่อให้ Asset ที่ใช้อยู่ยังเก็บค่าเดิมได้
export default function AssetSubtypeManager({ canEdit }) {
  const [types, setTypes] = useState(null);
  const [subtypes, setSubtypes] = useState([]);
  const [typeId, setTypeId] = useState("");
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/master/asset_types", { signal: controller.signal }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลด Asset Types ไม่สำเร็จ");
        return data.rows || [];
      }),
      fetch("/api/settings/asset-subtypes", { signal: controller.signal }).then(readApiResponse),
    ]).then(([typeRows, data]) => {
      const list = data.subtypes || [];
      // แสดงประเภทที่เปิดใช้ และประเภทที่ปิดแล้วแต่ยังมีประเภทย่อยค้างอยู่
      const shown = typeRows
        .filter((type) => type.is_active || list.some((item) => item.asset_type_id === String(type.id)))
        .sort((a, b) => String(a.prefix).localeCompare(String(b.prefix)));
      const stored = readStoredType();
      const first = shown.find((type) => list.some((item) => item.asset_type_id === String(type.id))) || shown[0];
      setTypes(shown);
      setSubtypes(list);
      setTypeId(shown.some((type) => String(type.id) === stored) ? stored : first ? String(first.id) : "");
    }).catch((e) => {
      if (e.name === "AbortError") return;
      setTypes([]);
      setError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    });
    return () => controller.abort();
  }, []);

  function chooseType(value) {
    setTypeId(value);
    storeType(value);
    setEditor(null);
    setMessage("");
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const body = editor.id
        ? { id: editor.id, name: editor.name, isActive: editor.isActive }
        : { assetTypeId: typeId, name: editor.name, isActive: editor.isActive };
      const data = await readApiResponse(await fetch("/api/settings/asset-subtypes", {
        method: editor.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      setSubtypes(data.subtypes || []);
      setMessage(editor.id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มประเภทย่อยแล้ว");
      setEditor(null);
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (types === null) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  const selectedType = types.find((type) => String(type.id) === typeId);
  const rows = subtypes.filter((item) => item.asset_type_id === typeId);
  const canAdd = canEdit && selectedType?.is_active;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <label className="block w-full sm:max-w-sm">
          <span className="mb-1 block text-sm font-medium">Asset Type</span>
          <select value={typeId} onChange={(event) => chooseType(event.target.value)} className={inputClass}>
            {types.map((type) => {
              const count = subtypes.filter((item) => item.asset_type_id === String(type.id)).length;
              return (
                <option key={type.id} value={String(type.id)}>
                  {type.prefix} — {type.name} ({count}){type.is_active ? "" : " · ปิดใช้งาน"}
                </option>
              );
            })}
          </select>
        </label>
        {canAdd && (
          <button type="button" onClick={() => { setEditor({ name: "", isActive: true }); setMessage(""); setError(""); }}
            className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">
            + เพิ่มประเภทย่อย
          </button>
        )}
      </div>

      {!canEdit && <p className="text-sm text-slate-600">ดูได้อย่างเดียว · เพิ่มหรือแก้ไขประเภทย่อยได้เฉพาะ Admin</p>}
      {message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {editor && (
        <form onSubmit={save} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editor.id ? "แก้ไขประเภทย่อย" : "เพิ่มประเภทย่อย"}
            <span className="ml-2 text-sm font-normal text-slate-500">{selectedType?.prefix} — {selectedType?.name}</span>
          </h2>
          <label className="block max-w-md">
            <span className="mb-1 block text-sm font-medium">ชื่อประเภทย่อย</span>
            <input autoFocus required maxLength={100} value={editor.name} className={inputClass}
              onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="เช่น Firewall" />
          </label>
          <label className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={editor.isActive}
              onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })} />
            ใช้งาน
          </label>
          {editor.id && !editor.isActive && editor.assetCount > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              มี {editor.assetCount} Asset ใช้อยู่ · Asset เหล่านี้ยังเก็บค่าเดิมไว้ แต่จะเลือกให้ Asset อื่นไม่ได้
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:flex">
            <button type="submit" disabled={busy || !editor.name.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-blue-900 disabled:opacity-50">
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button type="button" onClick={() => { setEditor(null); setError(""); }}
              className="rounded-lg border border-slate-300 px-4 py-2">
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold">ประเภทย่อย</th>
                <th className="px-4 py-3 font-semibold">จำนวน Asset</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                {canEdit && <th className="px-4 py-3 font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 transition hover:bg-blue-50/40">
                  <td className={`px-4 py-3 ${item.is_active ? "" : "text-slate-400"}`}>{item.name}</td>
                  <td className="px-4 py-3">{item.asset_count}</td>
                  <td className="px-4 py-3">
                    <span className={item.is_active ? "text-green-700" : "text-slate-500"}>
                      {item.is_active ? "● ใช้งาน" : "○ ปิดใช้งาน"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button type="button" className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                        onClick={() => {
                          setEditor({ id: item.id, name: item.name, isActive: item.is_active, assetCount: item.asset_count });
                          setMessage("");
                          setError("");
                        }}>
                        แก้ไข
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                    ยังไม่มีประเภทย่อยของ {selectedType?.name || "ประเภทนี้"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        ประเภทย่อยไม่อยู่ในรหัส Asset เปลี่ยนภายหลังได้โดยรหัสไม่เปลี่ยน · ลบไม่ได้ ให้ปิดใช้งานแทน
      </p>
    </div>
  );
}
