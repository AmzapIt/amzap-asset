import Link from "next/link";
import { query } from "@/lib/db";
import { workflowPageAccount } from "@/lib/asset-workflow-api";
import { isLocalSettingsServer, readServerSettings } from "@/lib/server-settings";
import packageInfo from "@/package.json";
import PhotoStorageSettings from "./PhotoStorageSettings";
import StickerSettings from "./StickerSettings";
import SettingsNav from "./SettingsNav";
import DocumentSettings from "./DocumentSettings";
import { getItSignerName } from "@/lib/document-settings";
import MachineSpecsSettings from "./MachineSpecsSettings";
import { getMachineSpecsEnabled } from "@/lib/machine-specs-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MASTER_ITEMS = [
  ["departments", "Departments", "แผนกของพนักงานและทรัพย์สิน"],
  ["locations", "Locations", "สถานที่ใช้งาน รวมถึงคลัง IT"],
  ["vendors", "Vendors", "ผู้จำหน่ายและผู้ให้บริการ"],
  ["asset_types", "Asset Types", "ประเภทอุปกรณ์"],
  ["accessory_types", "Accessory Types", "ประเภทอุปกรณ์เสริม"],
];

export default async function SettingsPage({ searchParams }) {
  const account = await workflowPageAccount();
  const admin = account.role === "Admin";
  const requested = (await searchParams)?.tab;
  const allowed = new Set(admin ? ["overview", "photos", "labels", "documents", "machine", "master"] : ["overview"]);
  const tab = typeof requested === "string" && allowed.has(requested) ? requested : "overview";
  const photoSettings = admin ? readServerSettings() : null;
  const itSignerName = admin && tab === "documents" ? await getItSignerName().catch(() => "") : "";
  const machineSpecsEnabled = admin && tab === "machine" ? await getMachineSpecsEnabled().catch(() => false) : false;
  let databaseOnline = false;
  let inUseCount = null;
  try {
    const result = await query("SELECT COUNT(*) FILTER (WHERE status='In Use')::int AS in_use FROM public.assets");
    databaseOnline = true;
    inUseCount = result.rows[0].in_use;
  } catch (error) {
    console.error("Settings overview database check failed", error);
  }
  const deployment = isLocalSettingsServer() ? "Local server" : "Vercel";
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || packageInfo.version;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">System configuration</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="mt-2 text-blue-100">ตรวจสถานะระบบและจัดการค่าที่ใช้ในการทำงาน</p>
        </header>

        <SettingsNav view={tab} admin={admin} />

        {tab === "overview" && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["เครื่องที่กำลังใช้งาน", inUseCount == null ? "ตรวจไม่ได้" : `${inUseCount} รายการ`, "นับ Asset สถานะ In Use"],
            ["เครื่องที่กำลังเปิดเว็บ", deployment, "ค่ารูป local จะแยกจาก Vercel"],
            ["เวอร์ชันโค้ด", version, process.env.VERCEL_GIT_COMMIT_SHA ? "Git commit บน Vercel" : "เวอร์ชันจาก package.json"],
            ["ฐานข้อมูล", databaseOnline ? "เชื่อมต่อได้" : "เชื่อมต่อไม่ได้", "ตรวจจากการอ่าน Asset ล่าสุด"],
          ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>)}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:col-span-2 xl:col-span-4"><h2 className="font-semibold text-amber-900">สำรองข้อมูลล่าสุด</h2><p className="mt-1 text-sm text-amber-800">ระบบยังไม่ได้รับข้อมูลจากงานสำรองฐานข้อมูล จึงไม่สามารถยืนยันวันที่สำรองล่าสุดได้</p></div>
        </section>}

        {tab === "photos" && admin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">การจัดเก็บรูป Asset</h2><p className="mt-1 mb-5 text-sm text-slate-600">เลือกรูปแบบการเก็บรูปและตรวจการเชื่อมต่อของเซิร์ฟเวอร์นี้</p><PhotoStorageSettings initialSettings={photoSettings} editable={isLocalSettingsServer()} driveCredentialsConfigured={Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN)} /></section>}

        {tab === "labels" && admin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">การพิมพ์สติ๊กเกอร์</h2><div className="mt-5"><StickerSettings /></div></section>}

        {tab === "documents" && admin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">รูปแบบเอกสาร</h2><p className="mt-2 text-sm text-slate-600">เอกสารปัจจุบันใช้ชื่อบริษัท AMZAP Group และโลโก้จากไฟล์ resources/reports/logo.png ส่วนชื่อผู้เซ็นฝั่ง IT ตั้งค่าได้ด้านล่าง</p><DocumentSettings initialName={itSignerName} /><div className="mt-5 grid gap-3 sm:grid-cols-2">{[["ชื่อบริษัท", "AMZAP Group"], ["โลโก้", "โลโก้ AMZAP ที่มากับระบบ"]].map(([name, value]) => <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm text-slate-500">{name}</p><p className="mt-2 font-semibold">{value}</p></div>)}</div><p className="mt-5 text-sm text-amber-800">ส่วนนี้แสดงค่าที่ใช้อยู่จริง ชื่อบริษัทและโลโก้ยังไม่เปิดให้แก้จากหน้าเว็บ เพื่อไม่ให้เอกสารจาก local server และ Vercel ใช้คนละแบบโดยไม่ตั้งใจ</p><Link href="/reports/handover" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-4 font-medium text-blue-700 hover:bg-blue-50">ไปหน้าเอกสาร</Link></section>}

        {tab === "machine" && admin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">สคริปต์ตรวจเครื่อง</h2><p className="mt-1 text-sm text-slate-600">อ่านสเปกจากเครื่องจริง แล้ววางลงหน้าแก้ไข Asset ได้ในครั้งเดียว</p><MachineSpecsSettings initialEnabled={machineSpecsEnabled} /></section>}

        {tab === "master" && admin &&<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">Master Data</h2><p className="mt-1 text-sm text-slate-600">ใช้หน้าจัดการเดิม ข้อมูลและการทำงานไม่เปลี่ยน</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MASTER_ITEMS.map(([kind, title, description]) => <Link key={kind} href={`/master/${kind}`} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"><span className="font-semibold text-blue-800">{title}</span><span className="mt-1 block text-sm text-slate-600">{description}</span></Link>)}</div></section>}
      </div>
    </main>
  );
}
