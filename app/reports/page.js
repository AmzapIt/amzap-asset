import Link from "next/link";
import {query} from "@/lib/db";
import {getReportAssets} from "@/lib/asset-report";
import ExportPanel from "./ExportPanel";
// หน้า Server Component อ่านฐานข้อมูลบน Node.js และโหลดใหม่เมื่อมี request
// ไม่ส่ง connection string หรือ SQL helper ไปทำงานบน browser
export const runtime="nodejs";
export const dynamic="force-dynamic";
// โหลด Asset และพนักงานพร้อมกันเพราะไม่ขึ้นต่อกัน แล้วส่งข้อมูลให้ ExportPanel
// แสดงทั้งพนักงาน Active/Inactive เพื่อรองรับใบคืนอุปกรณ์; ไม่ใช่การเปิดสิทธิ์ให้มอบหมาย
// ถ้าอ่านฐานข้อมูลล้มเหลว แสดงข้อความผิดพลาดแทนการแสดงรายการว่างที่อาจทำให้เข้าใจผิด
export default async function ReportsPage(){
  let assets,users;
  try{[assets,users]=await Promise.all([getReportAssets(),query('SELECT id::text AS id,employee_code,full_name,nickname,is_active,CASE WHEN is_active THEN 1 ELSE 0 END AS status FROM public."user" ORDER BY full_name')]);}
  catch(error){console.error("Reports load failed",error);return <main className="min-h-screen bg-slate-50 p-8"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">ไม่สามารถโหลดข้อมูลรายงานได้</p><Link className="mt-4 inline-block text-blue-700 hover:underline" href="/reports">ลองใหม่</Link></main>;}
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1600px] space-y-6"><header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-7 text-white shadow-lg"><p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">Documents & exports</p><h1 className="mt-2 text-3xl font-bold">Export & Handover</h1><p className="mt-2 text-blue-100">ส่งออกรายการทรัพย์สิน และจัดทำใบรับมอบจากข้อมูลในระบบ</p></header><ExportPanel assets={assets} users={users.rows}/></div></main>;
}
