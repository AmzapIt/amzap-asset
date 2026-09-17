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
  try{[assets,users]=await Promise.all([getReportAssets(),query('SELECT id::text AS id,employee_code,full_name,status FROM public."user" ORDER BY full_name')]);}
  catch(error){console.error("Reports load failed",error);return <main className="p-8"><p role="alert">ไม่สามารถโหลดข้อมูลรายงานได้</p><Link href="/reports">ลองใหม่</Link></main>;}
  return <main className="min-h-screen text-slate-900 bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-6xl space-y-6"><h1 className="text-3xl font-bold">Export & Handover</h1><p className="text-gray-600">ส่งออกรายการทรัพย์สิน และจัดทำใบรับมอบจากข้อมูลในระบบ</p><ExportPanel assets={assets} users={users.rows}/></div></main>;
}
