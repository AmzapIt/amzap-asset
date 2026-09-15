import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function display(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

export default async function UserDetailPage({ params }) {
  const { id } = await params;

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
      WHERE u.id = $1
    `,
    [id]
  );

  const user = userResult.rows[0];

  if (!user) {
    notFound();
  }

  // ==================================================
  // 2. ดึง Asset ที่พนักงานคนนี้ถืออยู่
  // ==================================================
  const assetResult = await query(
    `
      SELECT
        a.id,
        a.asset_code,
        a.asset_name,
        a.brand,
        a.model,
        a.serial_number,
        a.status,
        aa.assigned_date
      FROM public.asset_assignments aa
      INNER JOIN public.assets a
        ON a.id = aa.asset_id
      WHERE aa.assigned_to = $1
        AND aa.returned_date IS NULL
      ORDER BY a.asset_code
    `,
    [id]
  );

  const assets = assetResult.rows;

  const isActive =
    user.is_active === true &&
    Number(user.status) === 1;

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div>
          <Link
            href="/users"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับหน้า Users
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">
                User / Employee Detail
              </p>

              <h1 className="mt-1 text-3xl font-bold text-gray-800">
                {user.full_name}
              </h1>

              <p className="mt-2 text-gray-600">
                {user.position || "-"}
              </p>
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
          </div>
        </div>

        {/* Employee Information */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">
            Employee Information
          </h2>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <p className="text-sm text-gray-500">
                Employee Code
              </p>

              <p className="mt-1 font-medium">
                {display(user.employee_code)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Full Name
              </p>

              <p className="mt-1 font-medium">
                {display(user.full_name)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Position
              </p>

              <p className="mt-1 font-medium">
                {display(user.position)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Department
              </p>

              <p className="mt-1 font-medium">
                {display(user.department_name)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Email
              </p>

              <p className="mt-1 font-medium">
                {display(user.email)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Status
              </p>

              <p className="mt-1 font-medium">
                {isActive ? "Active" : "Inactive"}
              </p>
            </div>

          </div>
        </section>

        {/* Current Assets */}
        <section className="rounded-xl bg-white p-6 shadow">
          <div className="mb-5 flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Current Assets
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                อุปกรณ์ที่พนักงานคนนี้ครอบครองอยู่
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
              {assets.length} รายการ
            </span>

          </div>

          {assets.length === 0 ? (

            <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
              ยังไม่มี Asset ที่มอบหมายให้พนักงานคนนี้
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="min-w-full text-sm">

                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3">
                      Asset Code
                    </th>

                    <th className="px-4 py-3">
                      Asset Name
                    </th>

                    <th className="px-4 py-3">
                      Brand / Model
                    </th>

                    <th className="px-4 py-3">
                      Serial Number
                    </th>

                    <th className="px-4 py-3">
                      Status
                    </th>

                    <th className="px-4 py-3">
                      Assigned Date
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {assets.map((asset) => (

                    <tr
                      key={asset.id}
                      className="border-t hover:bg-gray-50"
                    >

                      <td className="px-4 py-3">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {asset.asset_code}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        {asset.asset_name || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {asset.serial_number || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {asset.status || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {asset.assigned_date
                          ? new Date(
                              asset.assigned_date
                            ).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "-"}
                      </td>

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
