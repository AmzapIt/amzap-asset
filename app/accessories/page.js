import Link from "next/link";
import { getAccessorySummary } from "@/lib/accessory-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function number(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

export default async function AccessoriesSummaryPage() {
  let summary;

  try {
    summary = await getAccessorySummary();
  } catch (error) {
    console.error("Load accessory summary failed:", error);

    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <h1 className="text-3xl font-bold">Accessory Summary</h1>
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          ไม่สามารถโหลดข้อมูล Accessories ได้ กรุณาลองใหม่
        </p>
      </main>
    );
  }

  const cards = [
    ["กำลังถืออยู่", summary.currentQuantity, "text-blue-700"],
    ["คืนแล้ว", summary.returnedQuantity, "text-emerald-700"],
    ["จำนวนเบิกสะสม", summary.issuedQuantity, "text-slate-900"],
    ["พนักงานที่ถืออยู่", summary.currentEmployees, "text-violet-700"],
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-7 text-white shadow-lg">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
              Equipment without Asset Code
            </p>
            <h1 className="mt-2 text-3xl font-bold">Accessory Summary</h1>
            <p className="mt-2 text-blue-100">
              สรุปจากรายการเบิกและคืน Accessories ของพนักงาน
            </p>
          </div>
          <Link href="/users" className="rounded-lg bg-white px-4 py-2.5 font-semibold text-blue-900">
            ดูพนักงาน
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, color]) => (
            <section key={label} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="text-sm text-slate-500">{label}</h2>
              <p className={`mt-3 text-3xl font-bold ${color}`}>{number(value)}</p>
            </section>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          จำนวนทั้งหมดคำนวณจาก Quantity ในประวัติการเบิก ไม่ใช่จำนวน Stock คงเหลือ
        </p>

        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-lg font-semibold">สรุปตามประเภท</h2>
            <p className="mt-1 text-sm text-slate-500">รวมทั้งประเภท Active และ Inactive ที่มีใน Master Data</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3">Accessory Type</th>
                  <th className="px-5 py-3 text-right">กำลังถืออยู่</th>
                  <th className="px-5 py-3 text-right">คืนแล้ว</th>
                  <th className="px-5 py-3 text-right">เบิกสะสม</th>
                  <th className="px-5 py-3 text-right">พนักงานปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {summary.types.map((type) => (
                  <tr key={type.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-medium">
                      {type.name}
                      {!type.is_active && <span className="ml-2 text-xs text-slate-400">Inactive</span>}
                    </td>
                    <td className="px-5 py-4 text-right">{number(type.current_quantity)}</td>
                    <td className="px-5 py-4 text-right">{number(type.returned_quantity)}</td>
                    <td className="px-5 py-4 text-right">{number(type.issued_quantity)}</td>
                    <td className="px-5 py-4 text-right">{number(type.current_employees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-lg font-semibold">พนักงานที่ถือ Accessories อยู่</h2>
            <p className="mt-1 text-sm text-slate-500">กดชื่อเพื่อดูรายการและประวัติในหน้า User Detail</p>
          </div>
          {summary.holders.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">ยังไม่มี Accessories ที่กำลังถูกถือครอง</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">ประเภทที่ถืออยู่</th>
                    <th className="px-5 py-3 text-right">จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.holders.map((holder) => (
                    <tr key={holder.id} className="border-t border-slate-100">
                      <td className="px-5 py-4">
                        <Link href={`/users/${holder.id}`} className="font-medium text-blue-700 hover:underline">
                          {holder.full_name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{holder.employee_code || "-"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{holder.accessory_types}</td>
                      <td className="px-5 py-4 text-right font-semibold">{number(holder.current_quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
