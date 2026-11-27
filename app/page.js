import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import DashboardBars from "./components/DashboardBars";
import RefreshDashboard from "./components/RefreshDashboard";
import { getAccessorySummary } from "@/lib/accessory-summary";
import { getReportAssets } from "@/lib/asset-report";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import { getRecentActivity } from "@/lib/dashboard";
import { assetListHref, summarizeAssets } from "@/lib/dashboard-summary";

// อ่านข้อมูลจาก PostgreSQL ทุกครั้งที่เปิดหน้า
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  "In Use": "กำลังใช้งาน", "In Stock": "ในคลัง", Repair: "อยู่ระหว่างซ่อม",
  Spare: "เครื่องสำรอง", Retired: "เลิกใช้ (Retired)", Disposed: "จำหน่ายแล้ว", Lost: "สูญหาย",
};
const ACTIVITY_LABELS = {
  new: ["รับเข้าใหม่", "bg-blue-50 text-blue-800"],
  return: ["รับคืน", "bg-emerald-50 text-emerald-800"],
  issue: ["เบิก", "bg-violet-50 text-violet-800"],
  move: ["ย้าย / เปลี่ยน Owner", "bg-slate-100 text-slate-700"],
};
const card = "min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6";
const number = (value) => Number(value).toLocaleString("th-TH");

async function load() {
  const [account, assets, accessories, activity] = await Promise.all([
    workflowPageAccount(), getReportAssets(), getAccessorySummary(), getRecentActivity(),
  ]);
  const loadedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date()).replace(",", "");
  return { account, accessories, activity, loadedAt, data: summarizeAssets(assets) };
}

export default async function Home() {
  let result;
  try { result = await load(); }
  catch (error) {
    unstable_rethrow(error); // ให้ redirect ไปหน้า login ทำงานตามปกติ
    console.error("Load dashboard failed", error);
    // โหลดไม่สำเร็จไม่ใช่ไม่มีข้อมูล ห้ามแสดงเลข 0
    return <main className="px-4 py-5 sm:px-6 sm:py-8"><h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1><p role="alert" className="mt-6 rounded bg-red-50 p-4 text-red-700">ไม่สามารถโหลด Dashboard ได้ กรุณาลองใหม่</p><Link href="/" className="mt-4 inline-block text-blue-700 underline">โหลดใหม่</Link></main>;
  }
  const { account, accessories, activity, loadedAt, data } = result;
  const specsPercent = data.specs.total ? Math.round((data.specs.imported / data.specs.total) * 100) : 0;
  const tiles = [
    { label: "ทรัพย์สินทั้งหมด", count: data.total, href: assetListHref() },
    ...data.statuses.map(({ status, count }) => ({
      label: STATUS_LABELS[status] || status, count, href: assetListHref({ status }),
      note: status === "In Use" && data.total ? `${Math.round((count / data.total) * 100)}% ของทั้งหมด` : "",
    })),
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">IT Asset Management</h1>
            <p className="mt-2 text-sm text-blue-100 sm:text-base">Dashboard · ข้อมูล ณ {loadedAt}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <RefreshDashboard />
            {account.canWrite && <Link href="/assets/add" className="rounded-lg bg-white px-4 py-2 text-center font-medium text-blue-900 hover:bg-blue-50">+ รับเครื่องใหม่</Link>}
          </div>
        </header>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">ภาพรวม</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
          {tiles.map(({ label, count, href, note }) => (
            <Link key={label} href={href} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:border-blue-400 sm:p-5">
              <span className="block text-sm text-slate-500">{label}</span>
              <span className="mt-2 block text-3xl font-bold">{number(count)}</span>
              {note && <span className="mt-1 block text-xs text-slate-500">{note}</span>}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardBars title="Asset ตามประเภท" rows={data.types} filterKey="type" emptyName="ไม่ระบุประเภท" />
          <DashboardBars title="Asset ตามสถานที่" rows={data.locations} filterKey="location" emptyName="ยังไม่ระบุสถานที่" />
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">งานของ IT</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={card}>
            <h3 className="text-lg font-semibold">ต้องจัดการ</h3>
            <ul className="mt-3 divide-y divide-slate-100">
              {data.issues.map(({ key, label, done, count }) => (
                <li key={key}>
                  {count > 0 ? (
                    <Link href={assetListHref({ issue: key })} className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
                      <span>{label}</span>
                      <span className="font-bold">{number(count)} <span aria-hidden="true" className="text-slate-400">›</span></span>
                    </Link>
                  ) : <p className="flex min-h-11 items-center text-sm text-slate-500">✓ {done}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              ไม่นับเครื่องที่เลิกใช้แล้ว · ประกันตรวจได้เฉพาะ {number(data.withWarranty)} จาก {number(data.total)} รายการที่กรอกวันหมดประกัน
            </p>
          </section>

          <section className={card}>
            <h3 className="text-lg font-semibold">พร้อมเบิกในคลัง</h3>
            {data.stock.length === 0 && <p className="mt-3 text-sm text-slate-500">ไม่มีเครื่องในคลัง</p>}
            <ul className="mt-3 divide-y divide-slate-100">
              {data.stock.map(({ name, count }) => (
                <li key={name || "__none__"}>
                  <Link href={assetListHref({ type: name, status: "In Stock" })} className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
                    <span>{name || "ไม่ระบุประเภท"}</span><span className="font-bold">{number(count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid content-start gap-6">
            <section className={card}>
              <h3 className="text-lg font-semibold">นำเข้าสเปกเครื่อง</h3>
              <p className="mt-1 text-xs text-slate-500">Notebook และ PC ที่ยังใช้อยู่</p>
              <p className="mt-3"><span className="text-3xl font-bold">{number(data.specs.imported)}</span> <span className="text-slate-500">/ {number(data.specs.total)} เครื่อง ({specsPercent}%)</span></p>
              <div className="mt-2 h-3 rounded bg-slate-100"><div className="h-3 rounded bg-[#2a78d6]" style={{ width: `${specsPercent}%` }} /></div>
              {data.specs.total > data.specs.imported && (
                <Link href={assetListHref({ issue: "noSpecs" })} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:underline">
                  เหลือ {number(data.specs.total - data.specs.imported)} เครื่อง ›
                </Link>
              )}
            </section>
            <section className={card}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold">Accessories</h3>
                <Link href="/accessories" className="text-sm font-semibold text-blue-700 hover:underline">ดูรายละเอียด</Link>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                ถืออยู่ <strong>{number(accessories.currentQuantity)}</strong> · คืนแล้ว <strong>{number(accessories.returnedQuantity)}</strong> · พนักงาน <strong>{number(accessories.currentEmployees)}</strong> คน
              </p>
            </section>
          </div>
        </div>

        <section className={card}>
          <h3 className="text-lg font-semibold">ความเคลื่อนไหวล่าสุด</h3>
          {activity.length === 0 && <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการ</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {activity.map((item, index) => {
              const [label, tone] = ACTIVITY_LABELS[item.kind];
              return (
                <li key={`${item.kind}-${item.asset_id}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>
                  <Link href={`/assets/${item.asset_id}`} className="font-semibold text-blue-700 hover:underline">{item.asset_code}</Link>
                  <span className="min-w-0 flex-1 text-slate-600">{[item.asset_type, item.person, item.place].filter(Boolean).join(" · ")}</span>
                  <span className="text-xs text-slate-500">{item.at}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
