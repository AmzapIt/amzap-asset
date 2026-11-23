"use client";

import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/client-api";

// ช่องเลือกประเภทย่อย แสดงเฉพาะรายการของ Asset Type ที่เลือก
// รายการที่ปิดใช้แล้วจะไม่แสดง ยกเว้นค่าเดิมของ Asset (currentSubtypeId)
export default function AssetSubtypeSelect({ assetTypeId, value, onChange, currentSubtypeId = "", className = "" }) {
  const [subtypes, setSubtypes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/asset-subtypes", { signal: controller.signal })
      .then(readApiResponse)
      .then((data) => setSubtypes(data.subtypes || []))
      .catch((e) => {
        if (e.name === "AbortError") return;
        setSubtypes([]);
        setError(e.message || "โหลดประเภทย่อยไม่สำเร็จ");
      });
    return () => controller.abort();
  }, []);

  const options = (subtypes || []).filter((item) =>
    item.asset_type_id === String(assetTypeId ?? "") &&
    (item.is_active || item.id === String(currentSubtypeId ?? "")));

  if (!assetTypeId || (subtypes && options.length === 0 && !error)) return null;

  return (
    <div>
      <label htmlFor="subtypeId" className="mb-2 block font-medium">ประเภทย่อย</label>
      <select id="subtypeId" name="subtypeId" value={value || ""} onChange={onChange}
        disabled={subtypes === null} className={className}>
        <option value="">{subtypes === null ? "กำลังโหลด..." : "-- ไม่ระบุ --"}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>{item.name}{item.is_active ? "" : " (ปิดใช้งาน)"}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">ไม่บังคับ · เปลี่ยนภายหลังได้ รหัส Asset ไม่เปลี่ยน</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
