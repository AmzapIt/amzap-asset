export default function Home() {
  // ข้อมูลตัวอย่างของ asset ที่ใช้ทั้งการ์ดสรุปและตาราง Recent Assets
  const assets = [
    {
      id: 1,
      assetCode: "NB-001",
      name: "Dell Latitude",
      type: "Notebook",
      status: "In Use",
    },
    {
      id: 2,
      assetCode: "NB-002",
      name: "Lenovo ThinkPad",
      type: "Notebook",
      status: "Available",
    },
    {
      id: 3,
      assetCode: "PC-001",
      name: "Dell Optiplex",
      type: "Desktop",
      status: "Repair",
    },
    {
      id: 4,
      assetCode: "SV-001",
      name: "Dell PowerEdge",
      type: "Server",
      status: "In Use",
    },

    {
      id: 5,
      assetCode: "SW-001",
      name: "Cisco CBS350",
      type: "Network",
      status: "Available",
    },
  ];

  // นับ asset ทั้งหมดจากจำนวนสมาชิกใน assets
  const totalAssets = assets.length;

  // กรอง assets ที่กำลังใช้งาน เพื่อแสดงจำนวนในการ์ด In Use
  const inUse = assets.filter(
    (asset) => asset.status === "In Use"
  ).length;

  // กรอง assets ที่พร้อมใช้งาน เพื่อแสดงจำนวนในการ์ด Available
  const available = assets.filter(
    (asset) => asset.status === "Available"
  ).length;

  // กรอง assets ที่อยู่ระหว่างซ่อม เพื่อแสดงจำนวนในการ์ด Repair
  const repair = assets.filter(
    (asset) => asset.status === "Repair"
  ).length;

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800">
        IT Asset Management
      </h1>

      <p className="mt-2 text-gray-500">
        Dashboard
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">

        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-500">
            Total Assets
          </p>

          <p className="mt-2 text-3xl font-bold">
            {totalAssets}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-500">
            In Use
          </p>

          <p className="mt-2 text-3xl font-bold">
            {inUse}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-500">
            Available
          </p>

          <p className="mt-2 text-3xl font-bold">
            {available}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-500">
            Repair
          </p>

          <p className="mt-2 text-3xl font-bold">
            {repair}
          </p>
        </div>



      </div>

      <div className="mt-8 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800">
          Recent Assets
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-3">
                  Asset Code
                </th>

                <th className="p-3">
                  Device
                </th>

                <th className="p-3">
                  Type
                </th>

                <th className="p-3">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ใช้ asset แต่ละรายการสร้างแถวในตาราง */}
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b"
                >
                  <td className="p-3">
                    {asset.assetCode}
                  </td>

                  <td className="p-3">
                    {asset.name}
                  </td>

                  <td className="p-3">
                    {asset.type}
                  </td>

                  <td className="p-3">
                    {asset.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}