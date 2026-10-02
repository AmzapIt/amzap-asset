import { query } from "@/lib/db";
import UserTable from "./UserTable";
import Link from "next/link";
import { getOffboardingSummaries } from "@/lib/offboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [result, offboardingSummaries] = await Promise.all([query(`
    WITH current_assignments AS (
      SELECT DISTINCT ON (assignment.asset_id)
        assignment.asset_id,
        assignment.assigned_to
      FROM public.asset_assignments assignment
      WHERE assignment.returned_date IS NULL
      ORDER BY
        assignment.asset_id,
        assignment.assigned_date DESC,
        assignment.id DESC
    ),
    current_holders AS (
      SELECT
        CASE
          WHEN current_assignment.assigned_to IS NOT NULL
            THEN current_assignment.assigned_to
          WHEN NOT EXISTS (
            SELECT 1
            FROM public.asset_assignments assignment_history
            WHERE assignment_history.asset_id = asset.id
          ) AND asset.status = 'In Use'
            AND NOT EXISTS (
              SELECT 1
              FROM public.employee_offboarding_items item
              JOIN public.employee_offboardings offboarding ON offboarding.id=item.offboarding_id
              WHERE item.asset_id=asset.id AND item.resolution='not_held'
                AND offboarding.user_id=asset.asset_owner_id
            )
            THEN asset.asset_owner_id
          ELSE NULL
        END AS user_id
      FROM public.assets asset
      LEFT JOIN current_assignments current_assignment
        ON current_assignment.asset_id = asset.id
    ),
    asset_counts AS (
      SELECT
        current_holders.user_id,
        COUNT(*)::int AS current_asset_count
      FROM current_holders
      WHERE current_holders.user_id IS NOT NULL
      GROUP BY current_holders.user_id
    )
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
      l.name AS location_name,
      COALESCE(asset_counts.current_asset_count, 0) AS current_asset_count
    FROM public."user" u
    LEFT JOIN public.departments d
      ON d.id = u.department_id
    LEFT JOIN public.locations l
      ON l.id = u.location_id
    LEFT JOIN asset_counts
      ON asset_counts.user_id = u.id
    ORDER BY u.full_name ASC
  `), getOffboardingSummaries()]);

  const users = result.rows.map((user) => ({
    ...user,
    ...(offboardingSummaries.get(String(user.id)) ?? {
      offboarding_id: null,
      pending_items: 0,
      pending_quantity: 0,
      review_items: 0,
      closed_at: null,
    }),
  }));
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
  const usersWithAssets = users.filter(
    (user) => Number(user.current_asset_count) > 0,
  ).length;
  const usersWithoutAssets = users.length - usersWithAssets;

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {[
            ["พนักงานทั้งหมด", users.length, "text-slate-900"],
            ["Active", activeUsers, "text-emerald-600"],
            ["Inactive", inactiveUsers, "text-rose-600"],
            ["Amzap โรงงาน 1", factoryOneUsers, "text-blue-700"],
            ["Amzap โรงงาน 2", factoryTwoUsers, "text-violet-700"],
            ["มี Asset", usersWithAssets, "text-emerald-700"],
            ["ยังไม่มี Asset", usersWithoutAssets, "text-amber-700"],
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
