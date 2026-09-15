import { query } from "@/lib/db";
import UserTable from "./UserTable";
// ใช้ Node.js เพราะหน้านี้ query PostgreSQL โดยตรง
export const runtime = "nodejs";

// ให้ดึงข้อมูลล่าสุดทุกครั้ง
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const result = await query(`
    SELECT
      u.id,
      u.employee_code,
      u.full_name,
      u.email,
      u.department_id,
      u.is_active,
      u.created_at,
      u."position",
      u.status,
      d.name AS department_name
    FROM public."user" u
    LEFT JOIN public.departments d
      ON d.id = u.department_id
    ORDER BY u.full_name ASC
  `);

  const users = result.rows;

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Users / Employees
          </h1>

          <p className="mt-1 text-gray-500">
            รายชื่อพนักงานทั้งหมดในระบบ
          </p>
        </div>

        {/* Summary */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              พนักงานทั้งหมด
            </p>

            <p className="mt-2 text-2xl font-bold">
              {users.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              Active
            </p>

            <p className="mt-2 text-2xl font-bold">
              {
                users.filter(
                  (user) =>
                    user.is_active === true &&
                    Number(user.status) === 1
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              Inactive
            </p>

            <p className="mt-2 text-2xl font-bold">
              {
                users.filter(
                  (user) =>
                    user.is_active === false ||
                    Number(user.status) === 0
                ).length
              }
            </p>
          </div>

        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="overflow-x-auto">

        <UserTable users={users} />


          </div>
        </div>

      </div>
    </main>
  );
}