import { query } from "@/lib/db";
import UserTable from "./UserTable";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const result = await query(`
    SELECT
      u.id,
      u.employee_code,
      u.full_name,
      u.nickname,
      u.email,
      u.department_id,
      u.location_id,
      u.is_active,
      u.created_at,
      u."position",
      d.name AS department_name,
      l.name AS location_name
    FROM public."user" u
    LEFT JOIN public.departments d
      ON d.id = u.department_id
    LEFT JOIN public.locations l
      ON l.id = u.location_id
    ORDER BY u.full_name ASC
  `);

  const users = result.rows;
  const activeUsers = users.filter((user) => user.is_active === true).length;
  const inactiveUsers = users.length - activeUsers;
  // Location ID 1 และ 2 ถูกกำหนดจาก migration 012 ให้เป็นโรงงาน 1 และ 2
  // ตัวเลขนี้รวมทั้ง Active/Inactive; คนที่ไม่มี Location หรืออยู่ที่อื่น
  // ยังอยู่ในยอดพนักงานทั้งหมด แต่ไม่อยู่ในการ์ดของสองโรงงานนี้
  const factoryOneUsers = users.filter(
    (user) => Number(user.location_id) === 1,
  ).length;
  const factoryTwoUsers = users.filter(
    (user) => Number(user.location_id) === 2,
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
              People & access
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Users / Employees
            </h1>
            <p className="mt-2 text-blue-100">
              จัดการรายชื่อพนักงานและสิทธิ์การใช้งานในระบบ
            </p>
          </div>
          <Link
            href="/users/add"
            className="w-full rounded-lg bg-white px-4 py-2.5 text-center font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 sm:w-auto"
          >
            + Add Employee
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            ["พนักงานทั้งหมด", users.length, "text-slate-900"],
            ["Active", activeUsers, "text-emerald-600"],
            ["Inactive", inactiveUsers, "text-rose-600"],
            ["Amzap โรงงาน 1", factoryOneUsers, "text-blue-700"],
            ["Amzap โรงงาน 2", factoryTwoUsers, "text-violet-700"],
          ].map(([label, value, color]) => (
            <section
              key={label}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className={`mt-3 text-3xl font-bold ${color}`}>
                {value.toLocaleString("th-TH")}
              </p>
            </section>
          ))}
        </div>

        <UserTable users={users} />
      </div>
    </main>
  );
}
