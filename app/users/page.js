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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-7 text-white shadow-lg">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
              People & access
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              Users / Employees
            </h1>
            <p className="mt-2 text-blue-100">
              จัดการรายชื่อพนักงานและสิทธิ์การใช้งานในระบบ
            </p>
          </div>
          <Link
            href="/users/add"
            className="rounded-lg bg-white px-4 py-2.5 font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50"
          >
            + Add Employee
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["พนักงานทั้งหมด", users.length, "text-slate-900"],
            ["Active", activeUsers, "text-emerald-600"],
            ["Inactive", inactiveUsers, "text-rose-600"],
          ].map(([label, value, color]) => (
            <section
              key={label}
              className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"
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
