"use client";

import { useMemo, useState } from "react";

const STATUS_OPTIONS = [
  "In Use",
  "In Stock",
  "Repair",
  "Spare",
  "Retired",
  "Disposed",
  "Lost",
];

const DEFAULT_STATUSES = STATUS_OPTIONS.slice(0, 5);

const STATUS_COLORS = {
  "In Use": "#2563eb",
  "In Stock": "#06b6d4",
  Repair: "#f59e0b",
  Spare: "#8b5cf6",
  Retired: "#64748b",
  Disposed: "#f97316",
  Lost: "#ef4444",
};

export default function AssetStatusByType({ rows }) {
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_STATUSES);
  const [message, setMessage] = useState("");

  const types = useMemo(() => {
    const typeMap = new Map();

    for (const row of rows) {
      const key = row.type_id ?? "unassigned";

      if (!typeMap.has(key)) {
        typeMap.set(key, {
          id: key,
          name: row.type_name || "ไม่ระบุ",
        });
      }
    }

    return [...typeMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "th"),
    );
  }, [rows]);

  // rows เป็นผล Aggregate จาก Server แล้ว จึงสร้าง Map ด้วยคู่ Type + Status
  // เพื่ออ่านจำนวนโดยไม่ Query ซ้ำ; คอลัมน์ "รวม" นับเฉพาะสถานะที่เลือกอยู่
  const countMap = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          `${row.type_id ?? "unassigned"}:${row.status}`,
          Number(row.count),
        ]),
      ),
    [rows],
  );

  const chartRows = useMemo(
    () =>
      types.map((type) => {
        const segments = selectedStatuses.map((status) => ({
          status,
          count: countMap.get(`${type.id}:${status}`) ?? 0,
        }));

        return {
          ...type,
          segments,
          total: segments.reduce((sum, segment) => sum + segment.count, 0),
        };
      }),
    [countMap, selectedStatuses, types],
  );

  const maxTypeTotal = Math.max(
    1,
    ...chartRows.map((type) => type.total),
  );

  function toggleStatus(status) {
    setMessage("");

    setSelectedStatuses((current) => {
      if (current.includes(status)) {
        if (current.length === 1) {
          setMessage("ต้องเลือกอย่างน้อย 1 สถานะ");
          return current;
        }

        return current.filter((item) => item !== status);
      }

      if (current.length >= 5) {
        setMessage("เลือกแสดงได้สูงสุด 5 สถานะ");
        return current;
      }

      return STATUS_OPTIONS.filter(
        (item) => current.includes(item) || item === status,
      );
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            จำนวน Asset ตามสถานะและประเภท
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            เลือกสถานะที่ต้องการเปรียบเทียบได้สูงสุด 5 สถานะ
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          เลือกแล้ว {selectedStatuses.length}/5
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => {
          const checked = selectedStatuses.includes(status);

          return (
            <label
              key={status}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                checked
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleStatus(status)}
                className="sr-only"
              />
              {status}
            </label>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="mt-2 text-sm text-amber-700">
        {message}
      </p>

      {types.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">ยังไม่มีข้อมูล Asset</p>
      ) : (
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(620px,1.05fr)_minmax(420px,1fr)] xl:items-stretch">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Asset Type</th>
                  {selectedStatuses.map((status) => (
                    <th key={status} className="whitespace-nowrap px-4 py-3 text-right">
                      {status}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const counts = selectedStatuses.map(
                    (status) => countMap.get(`${type.id}:${status}`) ?? 0,
                  );
                  const total = counts.reduce((sum, count) => sum + count, 0);

                  return (
                    <tr key={type.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {type.name}
                      </td>
                      {counts.map((count, index) => (
                        <td
                          key={selectedStatuses[index]}
                          className="px-4 py-3 text-right tabular-nums"
                        >
                          {count.toLocaleString("th-TH")}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {total.toLocaleString("th-TH")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">รวม</td>
                  {selectedStatuses.map((status) => {
                    const total = types.reduce(
                      (sum, type) =>
                        sum + (countMap.get(`${type.id}:${status}`) ?? 0),
                      0,
                    );

                    return (
                      <td key={status} className="px-4 py-3 text-right tabular-nums">
                        {total.toLocaleString("th-TH")}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {types
                      .reduce(
                        (sum, type) =>
                          sum +
                          selectedStatuses.reduce(
                            (typeSum, status) =>
                              typeSum +
                              (countMap.get(`${type.id}:${status}`) ?? 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString("th-TH")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold text-slate-800">
                กราฟเปรียบเทียบตามประเภท
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                ความยาวของแถบเทียบกับประเภทที่มี Asset มากที่สุด
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="คำอธิบายสีสถานะ">
              {selectedStatuses.map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  {status}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-5">
              {chartRows.map((type) => (
                <div key={type.id}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate font-medium text-slate-700">
                      {type.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {type.total.toLocaleString("th-TH")}
                    </span>
                  </div>
                  <div
                    className="flex h-3 overflow-hidden rounded-full bg-slate-200"
                    aria-label={`${type.name} รวม ${type.total.toLocaleString("th-TH")} Asset`}
                    role="img"
                  >
                    {type.segments.map((segment) => (
                      <span
                        key={segment.status}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          backgroundColor: STATUS_COLORS[segment.status],
                          width: `${(segment.count / maxTypeTotal) * 100}%`,
                        }}
                        title={`${segment.status}: ${segment.count.toLocaleString("th-TH")}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
