import Link from "next/link";
import { STATUS_GROUPS, assetListHref } from "@/lib/dashboard-summary";

// กราฟแท่งแนวนอนแบ่งสีตามสถานะ · ชี้ที่สีเห็นจำนวน และมีตัวเลขกำกับทุกแถว ไม่พึ่งสีอย่างเดียว
// filterKey: "type" | "location" ใช้สร้างลิงก์ไปหน้ารายการที่กรองไว้
export default function DashboardBars({ title, rows, filterKey, emptyName }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  const shown = STATUS_GROUPS.filter(({ key }) => rows.some((row) => row.statuses[key]));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {shown.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {shown.map(({ key, label, color }) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />{label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length === 0 && <p className="mt-4 text-sm text-slate-500">ยังไม่มีทรัพย์สิน</p>}
      <ul className="mt-3 space-y-1">
        {rows.map((row) => {
          const name = row.name === null ? "อื่นๆ" : row.name || emptyName;
          const detail = STATUS_GROUPS.filter(({ key }) => row.statuses[key])
            .map(({ key, label }) => `${label} ${row.statuses[key]}`).join(" · ");
          const content = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words font-medium text-slate-800">{name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {detail} <strong className="ml-1 text-sm text-slate-900">{row.total.toLocaleString("th-TH")}</strong>
                </span>
              </span>
              <span className="mt-1.5 flex h-3 gap-0.5 overflow-hidden rounded-r" style={{ width: `${(row.total / max) * 100}%` }}>
                {STATUS_GROUPS.filter(({ key }) => row.statuses[key]).map(({ key, label, color }) => (
                  <span key={key} title={`${name} · ${label} ${row.statuses[key]}`} className="h-full min-w-1"
                    style={{ background: color, flexGrow: row.statuses[key], flexBasis: 0 }} />
                ))}
              </span>
            </>
          );
          const className = "block rounded-lg px-2 py-2";
          return (
            <li key={row.name === null ? "__rest__" : row.name || "__none__"} className="-mx-2">
              {row.name === null ? <div className={className}>{content}</div> : filterKey === "type" && !row.name ? <div className={className}>{content}</div> : (
                <Link href={assetListHref({ [filterKey]: row.name || "__none__" })} className={`${className} transition hover:bg-slate-50`}>{content}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
