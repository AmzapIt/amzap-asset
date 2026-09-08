import Link from "next/link";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const result = await query(`
    SELECT
      id,
      asset_code,
      asset_name,
      brand,
      model,
      status,
      TO_CHAR(purchase_date, 'DD/MM/YYYY') AS purchase_date
    FROM v_asset_list
    ORDER BY id DESC
  `);

  const assets = result.rows;

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Assets
            </h1>

            <p className="mt-2 text-gray-500">
              ข้อมูลทรัพย์สินจาก PostgreSQL
            </p>
          </div>

          <Link
            href="/assets/add"
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            + Add Asset
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b p-4">
            <h2 className="font-semibold">
              Asset List ({assets.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4">Asset Code</th>
                  <th className="p-4">Asset Name</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Model</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Purchase Date</th>
                </tr>
              </thead>

              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-t">
                    <td className="p-4 font-medium">
                      {asset.asset_code}
                    </td>

                    <td className="p-4">
                      {asset.asset_name}
                    </td>

                    <td className="p-4">
                      {asset.brand || "-"}
                    </td>

                    <td className="p-4">
                      {asset.model || "-"}
                    </td>

                    <td className="p-4">
                      {asset.status}
                    </td>

                    <td className="p-4">
                      {asset.purchase_date || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {assets.length === 0 && (
            <p className="p-6 text-center text-gray-500">
              ยังไม่มีข้อมูลทรัพย์สิน
            </p>
          )}
        </div>
      </div>
    </main>
  );
}