"use client";
import { useEffect, useState } from "react";
const allFields = ["department", "location", "vendor"];

export default function AssetLookups({ form, onChange, fields = allFields }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      fields.map(async (name) => {
        const kind = `${name}s`;
        const r = await fetch(`/api/master/${kind}`, {
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d.rows;
      }),
    )
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [fields]);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {error && <p role="alert">{error}</p>}
      {fields.map((name, index) => (
        <label key={name} className="block">
          {name}
          <select
            className="block w-full border rounded p-3"
            name={name}
            value={form[name] ?? ""}
            onChange={onChange}
            disabled={!data}
          >
            <option value="">ไม่ระบุ</option>
            {data?.[index]
              .filter((r) => r.is_active || String(r.id) === form[name])
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {!r.is_active ? " (Inactive)" : ""}
                </option>
              ))}
          </select>
        </label>
      ))}
    </div>
  );
}
