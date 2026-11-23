"use client";

import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/client-api";

const inputClass = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

async function sendSubtype(method, body) {
  return readApiResponse(await fetch("/api/settings/asset-subtypes", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

// แถวประเภทย่อยที่มีอยู่: แก้ชื่อ ลำดับ และเปิด/ปิด (ไม่มีลบ เพื่อให้ Asset เดิมยังอ้างถึงได้)
function SubtypeRow({ item, busy, onSave }) {
  const [name, setName] = useState(item.name);
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));
  const changed = name.trim() !== item.name || Number(sortOrder) !== item.sort_order;

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
        aria-label={`ชื่อประเภทย่อย ${item.name}`} className={`${inputClass} min-w-40 flex-1 ${item.is_active ? "" : "text-slate-400"}`} />
      <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, "").slice(0, 3))}
        inputMode="numeric" aria-label={`ลำดับของ ${item.name}`} title="ลำดับ" className={`${inputClass} w-16 text-center`} />
      <span className="w-20 text-xs text-slate-500">{item.asset_count} Asset</span>
      {changed && (
        <button type="button" disabled={busy || !name.trim()}
          onClick={() => onSave({ id: item.id, name, sortOrder: Number(sortOrder || 0), isActive: item.is_active })}
          className="min-h-10 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
          บันทึก
        </button>
      )}
      <button type="button" disabled={busy}
        onClick={() => onSave({ id: item.id, name: item.name, sortOrder: item.sort_order, isActive: !item.is_active })}
        className={`min-h-10 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${item.is_active ? "border-slate-300 text-slate-700" : "border-emerald-300 text-emerald-800"}`}>
        {item.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
    </li>
  );
}

function AddSubtype({ assetTypeId, busy, onSave, nextOrder }) {
  const [name, setName] = useState("");
  return (
    <form className="mt-2 flex flex-wrap gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSave({ assetTypeId, name, sortOrder: nextOrder, isActive: true })) setName("");
      }}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
        placeholder="เพิ่มประเภทย่อย" aria-label="ชื่อประเภทย่อยใหม่" className={`${inputClass} min-w-40 flex-1`} />
      <button type="submit" disabled={busy || !name.trim()}
        className="min-h-10 rounded-lg border border-blue-300 px-3 text-sm font-semibold text-blue-800 disabled:opacity-50">
        + เพิ่ม
      </button>
    </form>
  );
}

export default function AssetSubtypeSettings() {
  const [types, setTypes] = useState(null);
  const [subtypes, setSubtypes] = useState([]);
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
      setTypes(typeRows);
      setSubtypes(data.subtypes || []);
    }).catch((e) => {
      if (e.name === "AbortError") return;
      setTypes([]);
      setError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    });
    return () => controller.abort();
  }, []);

  async function save(body) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = await sendSubtype(body.id ? "PUT" : "POST", body);
      setSubtypes(data.subtypes || []);
      setMessage("บันทึกแล้ว");
      return true;
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (types === null) return <p className="mt-5 text-sm text-slate-500">กำลังโหลด...</p>;

  // แสดงประเภทที่เปิดใช้ และประเภทที่ปิดแล้วแต่ยังมีประเภทย่อยค้างอยู่
  const groups = [...types]
    .filter((type) => type.is_active || subtypes.some((item) => item.asset_type_id === String(type.id)))
    .sort((a, b) => String(a.prefix).localeCompare(String(b.prefix)))
    .map((type) => ({ type, items: subtypes.filter((item) => item.asset_type_id === String(type.id)) }));

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm text-slate-600">
        ประเภทย่อยไม่อยู่ในรหัส Asset เปลี่ยนภายหลังได้โดยรหัสไม่เปลี่ยน · ลบไม่ได้ ให้ปิดใช้งานแทน Asset เดิมยังเก็บค่าไว้
      </p>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(({ type, items }) => (
          <section key={type.id} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">
              {type.name} <span className="font-mono text-sm text-slate-500">({type.prefix})</span>
              {!type.is_active && <span className="ml-2 text-xs font-normal text-amber-700">Asset Type ปิดใช้งาน</span>}
            </h3>
            {items.length === 0 && <p className="mt-2 text-sm text-slate-500">ยังไม่มีประเภทย่อย</p>}
            <ul className="mt-1 divide-y divide-slate-100">
              {items.map((item) => (
                <SubtypeRow key={`${item.id}-${item.name}-${item.sort_order}`} item={item} busy={busy} onSave={save} />
              ))}
            </ul>
            {type.is_active && (
              <AddSubtype assetTypeId={String(type.id)} busy={busy} onSave={save}
                nextOrder={Math.min(999, items.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1)} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
