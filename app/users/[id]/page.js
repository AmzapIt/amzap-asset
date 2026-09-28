import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import AccessorySection from "./AccessorySection";
import DeleteUserButton from "./DeleteUserButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function display(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).split("-").reverse().join("/");
}

export default async function UserDetailPage({ params }) {
  const { id } = await params;
  const session = await auth();
  const canWrite = ["Admin", "IT Staff"].includes(session?.user?.role);
  const canManageUsers = session?.user?.role === "Admin";

  // รับเฉพาะเลข ID
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  // ==================================================
  // 1. ดึงข้อมูลพนักงาน
  // ==================================================
  const userResult = await query(
    `
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
        l.name AS user_location_name
      FROM public."user" u
      LEFT JOIN public.departments d
        ON d.id = u.department_id
      LEFT JOIN public.locations l
        ON l.id = u.location_id
      WHERE u.id = $1
    `,
    [id],
  );

  const user = userResult.rows[0];

  if (!user) {
    notFound();
  }

  // ==================================================
  // 2. ดึง Asset ปัจจุบันและประวัติที่พนักงานคนนี้เคยถือ
  // ==================================================
  const [currentAssetResult, assetHistoryResult] = await Promise.all([
    query(
      `
        SELECT
          a.id,
          a.asset_code,
          a.asset_name,
          a.brand,
          a.model,
          a.serial_number,
          a.status,
          aa.id AS assignment_id,
          aa.assigned_date::text AS assigned_date,
          aa.assignment_notes,
          l.name AS location_name,
          d.name AS assignment_department,
          CASE
            WHEN aa.id IS NOT NULL THEN 'Assignment'
            ELSE 'Asset Owner (ข้อมูลเดิม)'
          END AS holder_source
        FROM public.assets a
        LEFT JOIN LATERAL (
          SELECT current_assignment.*
          FROM public.asset_assignments current_assignment
          WHERE current_assignment.asset_id = a.id
            AND current_assignment.returned_date IS NULL
          ORDER BY current_assignment.assigned_date DESC, current_assignment.id DESC
          LIMIT 1
        ) aa ON true
        LEFT JOIN public.locations l
          ON l.id = a.location_id
        LEFT JOIN public.departments d
          ON d.id = a.owning_department_id
        WHERE
          aa.assigned_to = $1
          OR (
            aa.id IS NULL
            AND a.asset_owner_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM public.asset_assignments assignment_history
              WHERE assignment_history.asset_id = a.id
            )
          )
        ORDER BY a.asset_code, a.id
      `,
      [id],
    ),
    query(
      `
        SELECT
          a.id,
          a.asset_code,
          a.asset_name,
          a.brand,
          a.model,
          a.serial_number,
          a.status,
          aa.id AS assignment_id,
          aa.assigned_date::text AS assigned_date,
          aa.returned_date::text AS returned_date,
          aa.assignment_notes,
          aa.return_notes,
          l.name AS location_name,
          d.name AS assignment_department
        FROM public.asset_assignments aa
        INNER JOIN public.assets a
          ON a.id = aa.asset_id
        LEFT JOIN public.locations l
          ON l.id = aa.location_id
        LEFT JOIN public.departments d
          ON d.id = aa.department_id
        WHERE aa.assigned_to = $1
          AND aa.returned_date IS NOT NULL
        ORDER BY aa.returned_date DESC, aa.assigned_date DESC, aa.id DESC
      `,
      [id],
    ),
  ]);

  const currentAssets = currentAssetResult.rows;
  const assetHistory = assetHistoryResult.rows;

  const isActive = user.is_active === true;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <div>
          <Link href="/users" className="text-sm text-blue-600 hover:underline">
            ← กลับหน้า Users
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">User / Employee Detail</p>

              <h1 className="mt-1 break-words text-2xl font-bold text-gray-800 sm:text-3xl">
                {user.full_name}
              </h1>

              {user.nickname && (
                <p className="mt-1 text-sm font-medium text-blue-700">
                  Nickname: {user.nickname}
                </p>
              )}

              <p className="mt-2 text-gray-600">{user.position || "-"}</p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
            {canManageUsers && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/users/${id}/edit`}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-white"
                >
                  Edit Employee
                </Link>
                <DeleteUserButton
                  userId={id}
                  userName={user.full_name}
                />
              </div>
            )}
          </div>
        </div>

        {/* Employee Information */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">
            Employee Information
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Employee Code</p>

              <p className="mt-1 font-medium">{display(user.employee_code)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Full Name</p>

              <p className="mt-1 font-medium">{display(user.full_name)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Nickname</p>

              <p className="mt-1 font-medium">{display(user.nickname)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Position</p>

              <p className="mt-1 font-medium">{display(user.position)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Department</p>

              <p className="mt-1 font-medium">
                {display(user.department_name)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Location</p>

              <p className="mt-1 font-medium">
                {display(user.user_location_name)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Email</p>

              <p className="mt-1 font-medium">{display(user.email)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Status</p>

              <p className="mt-1 font-medium">
                {isActive ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
        </section>

        {/* Current Assets */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Current Assets
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                อุปกรณ์ที่พนักงานคนนี้ครอบครองอยู่
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {currentAssets.length} รายการ
            </span>
          </div>

          {currentAssets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
              ยังไม่มี Asset ที่มอบหมายให้พนักงานคนนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3">Asset Code</th>

                    <th className="px-4 py-3">Asset Name</th>

                    <th className="px-4 py-3">Brand / Model</th>

                    <th className="px-4 py-3">Serial Number</th>

                    <th className="px-4 py-3">Status</th>

                    <th className="px-4 py-3">Source</th>

                    <th className="px-4 py-3">Assigned Date</th>
                  </tr>
                </thead>

                <tbody>
                  {currentAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="border-t border-slate-100 hover:bg-blue-50/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {asset.asset_code}
                        </Link>
                      </td>

                      <td className="px-4 py-3">{asset.asset_name || "-"}</td>

                      <td className="px-4 py-3">
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {asset.serial_number || "-"}
                      </td>

                      <td className="px-4 py-3">{asset.status || "-"}</td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {asset.holder_source}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(asset.assigned_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Asset History */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Asset History
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                ประวัติ Asset ที่พนักงานเคยครอบครองและคืนแล้ว
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {assetHistory.length} รายการ
            </span>
          </div>

          {assetHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
              ยังไม่มีประวัติการครอบครอง Asset
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Brand / Model</th>
                    <th className="px-4 py-3">Department / Location</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Returned</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assetHistory.map((asset) => (
                    <tr
                      key={asset.assignment_id}
                      className="border-t border-slate-100 align-top hover:bg-blue-50/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {asset.asset_code}
                        </Link>
                        <p className="mt-1 text-gray-600">
                          {asset.asset_name || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {[
                          asset.assignment_department,
                          asset.location_name,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(asset.assigned_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(asset.returned_date)}
                      </td>
                      <td className="min-w-56 px-4 py-3 text-gray-600">
                        {[asset.assignment_notes, asset.return_notes]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AccessorySection userId={id} canWrite={canWrite} />
      </div>
    </main>
  );
}
