import Link from "next/link";
import AssetStatusByType from "./components/AssetStatusByType";
import RefreshDashboard from "./components/RefreshDashboard";
import { getDashboard } from "@/lib/dashboard";
import { getAccessorySummary } from "@/lib/accessory-summary";

// Refresh PostgreSQL data on each request; never publish a static build snapshot.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Asset = { id:string; asset_code:string; asset_name:string; status:string; type_name:string; warranty_end:string|null };
type Group = { kind:string; key:string|null; label:string; count:number };
type StatusTypeCount = { status:string; type_id:string|null; type_name:string; count:number };

// ตารางกลางสำหรับรายการติดตามทุกหมวด ใช้ Asset ID สร้างลิงก์ไปหน้า Detail
// warranty=true สลับคอลัมน์สุดท้ายเป็นวันหมดประกัน มิฉะนั้นแสดงสถานะ
// แยกกรณีไม่มีรายการออกจากกรณีอ่าน DB ไม่สำเร็จที่ Home จัดการ
function AssetRows({ rows, warranty = false }: { rows:Asset[]; warranty?:boolean }) {
  if (!rows.length) return <p className="py-5 text-sm text-gray-500">ไม่มีรายการ</p>;
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><table className="min-w-[520px] w-full text-left text-sm">
    <thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Asset</th><th className="py-3 pr-4">ประเภท</th><th className="py-3">{warranty ? "วันหมดประกัน" : "สถานะ"}</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id} className="border-b last:border-0"><td className="py-3 pr-4"><Link href={`/assets/${row.id}`} className="font-medium text-blue-700 hover:underline">{row.asset_code}</Link><p className="mt-1 text-gray-600">{row.asset_name}</p></td><td className="py-3 pr-4">{row.type_name}</td><td className="whitespace-nowrap py-3">{warranty ? row.warranty_end : row.status}</td></tr>)}</tbody>
  </table></div>;
}

// อ่านข้อมูลรวมจาก getDashboard แล้วกระจายไปการ์ด กราฟ และตาราง โดยไม่ query ซ้ำในแต่ละส่วน
// แถบกราฟคิดสัดส่วน count/total และป้องกันหารศูนย์เมื่อยังไม่มี Asset
// จำนวนทั้งหมดของรายการติดตามอาจมากกว่าแถวที่แสดง เพราะ query จำกัดตารางไว้ 10 แถว
export default async function Home() {
  let data;
  let accessorySummary;
  try { [data, accessorySummary] = await Promise.all([getDashboard(), getAccessorySummary()]); }
  catch (error) {
    console.error("Load dashboard failed",error);
    // A connection failure is not an empty inventory: never show misleading zeros.
    return <main className="px-4 py-5 sm:px-6 sm:py-8"><h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1><p role="alert" className="mt-6 rounded bg-red-50 p-4 text-red-700">ไม่สามารถโหลด Dashboard ได้ กรุณาลองใหม่</p><Link href="/" className="mt-4 inline-block text-blue-700 underline">โหลดใหม่</Link></main>;
  }
  const cards = [["ทรัพย์สินทั้งหมด",data.total],["กำลังใช้งาน",data.inUse],["ในคลัง / สำรอง",data.inStock],["อยู่ระหว่างซ่อม",data.repair]];
  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-2xl font-bold text-white sm:text-3xl">IT Asset Management</h1><p className="mt-2 text-sm text-blue-100 sm:text-base">Dashboard · ข้อมูล ณ เวลาเปิดหน้า</p></div><div className="grid grid-cols-2 gap-3 sm:flex"><RefreshDashboard /><Link href="/assets" className="rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-blue-900 sm:text-base">ดูทรัพย์สินทั้งหมด</Link></div></header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><section key={String(label)} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"><h2 className="text-sm text-gray-500">{label}</h2><p className="mt-3 text-3xl font-bold">{Number(value).toLocaleString("th-TH")}</p></section>)}</div>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Accessory Summary</h2>
            <p className="mt-1 text-sm text-slate-500">อุปกรณ์ที่ไม่ต้องมี Asset Code · นับจาก Quantity</p>
          </div>
          <Link href="/accessories" className="text-sm font-semibold text-blue-700 hover:underline">ดูรายละเอียด</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            ["กำลังถืออยู่", accessorySummary.currentQuantity],
            ["คืนแล้ว", accessorySummary.returnedQuantity],
            ["พนักงานที่ถืออยู่", accessorySummary.currentEmployees],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold">{Number(value).toLocaleString("th-TH")}</p>
            </div>
          ))}
        </div>
      </section>
      <AssetStatusByType rows={data.statusTypeCounts as StatusTypeCount[]} />
      <div className="grid gap-6 lg:grid-cols-3">{[["status","ตามสถานะ"],["type","ตามประเภท"],["owner","ตาม Asset Owner"]].map(([kind,title])=><section key={kind} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 max-h-72 space-y-3 overflow-y-auto">{data.groups.filter((g:Group)=>g.kind===kind).map((g:Group)=><div key={`${g.key}:${g.label}`}><div className="flex justify-between gap-4 text-sm"><span className="break-words">{g.label}</span><span>{g.count.toLocaleString("th-TH")}</span></div><div className="mt-1 h-2 rounded bg-gray-100"><div className="h-2 rounded bg-blue-500" style={{width:`${data.total ? g.count/data.total*100 : 0}%`}} /></div></div>)}{!data.total&&<p className="text-gray-500">ยังไม่มีทรัพย์สิน</p>}</div></section>)}</div>
      <p className="text-sm text-gray-500">Owner คือเจ้าของทรัพย์สิน ไม่ใช่ผู้รับมอบหมาย</p>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">ประกันหมดภายใน 30 วัน ({data.warrantyCount})</h2><p className="text-sm text-gray-500">รวมวันนี้ · แสดงสูงสุด 10 รายการที่หมดก่อน</p><AssetRows rows={data.warranty} warranty /></section>
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">ทรัพย์สินที่มีงานซ่อมค้าง ({data.maintenanceCount})</h2><p className="text-sm text-gray-500">งาน Open / In Progress · แสดงสูงสุด 10 ทรัพย์สิน</p><AssetRows rows={data.maintenance} /></section>
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">ยังไม่ได้เชื่อม Asset Owner ({data.missingOwnerCount})</h2><p className="text-sm text-gray-500">รวมข้อมูลชื่อเดิมที่ยังไม่เชื่อมพนักงาน · แสดงสูงสุด 10 รายการ</p><AssetRows rows={data.missingOwner} /></section>
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">ทรัพย์สินที่เพิ่มล่าสุด</h2><p className="text-sm text-gray-500">10 รายการล่าสุด</p><AssetRows rows={data.recent} /></section>
      </div>
    </div>
  </main>;
}
