import AssignmentForm from "./AssignmentForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";

// ใช้ Node.js เพราะหน้านี้เชื่อม PostgreSQL ผ่าน pg
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ==================================================
// 1. Helper สำหรับแสดงข้อมูล
// ==================================================

// แสดง "-" เมื่อไม่มีข้อมูล แต่ไม่ทำให้เลข 0 หรือ false หายไป
function display(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "ใช่" : "ไม่ใช่";
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
}

// แปลงวันที่เป็น dd/mm/yyyy
function formatDate(value, withTime = false) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: withTime ? "Asia/Bangkok" : "UTC",
  }).format(date);
}

// แสดงราคาโดยไม่เปลี่ยนข้อมูลใน Database
function formatMoney(value, currency = "THB") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "THB"}`;
}

// ==================================================
// 2. Component สำหรับแสดงคู่ Label / Value
// ==================================================
function InfoGrid({ rows }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-gray-500">{label}</dt>
          <dd className="mt-1 break-words whitespace-pre-wrap font-medium text-gray-800">
            {display(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Section แบบกดเปิด / ปิดได้
function DetailSection({ title, children }) {
  return (
    <details className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <summary className="cursor-pointer px-6 py-5 font-semibold text-gray-800">
        {title}
      </summary>

      <div className="border-t px-6 py-5">{children}</div>
    </details>
  );
}

// ==================================================
// 3. Helper สำหรับอ่านตารางเสริม
// ถ้าตารางยังไม่มี จะคืน null แทนการทำให้หน้าพัง
// ==================================================
async function readOptional(tableName, sql, values = []) {
  // ตรวจว่าตารางมีอยู่จริงก่อน
  const check = await query("SELECT to_regclass($1) AS table_name", [
    `public.${tableName}`,
  ]);

  if (!check.rows[0].table_name) {
    return null;
  }

  // SQL ที่ส่งเข้ามาเป็นคำสั่งที่กำหนดไว้ในโค้ดเท่านั้น
  // ส่วนค่าจากผู้ใช้ใช้ $1, $2 เพื่อป้องกัน SQL Injection
  const result = await query(sql, values);
  return result.rows;
}

// อ่านข้อมูลอ้างอิง เช่น People / Location / Vendor
async function readLookup(tableName, ids) {
  const validIds = [...new Set(ids.filter((id) => id != null))];

  if (validIds.length === 0) return [];

  const lookupSql = {
    user: 'SELECT * FROM public."user" WHERE id = ANY($1::bigint[])',
    locations: "SELECT * FROM public.locations WHERE id = ANY($1::bigint[])",
    departments:
      "SELECT * FROM public.departments WHERE id = ANY($1::bigint[])",
    vendors: "SELECT * FROM public.vendors WHERE id = ANY($1::bigint[])",
  };

  // ใช้เฉพาะชื่อตารางที่กำหนดไว้ ไม่รับชื่อ SQL จากผู้ใช้
  const sql = lookupSql[tableName];
  if (!sql) return [];

  return (await readOptional(tableName, sql, [validIds])) ?? [];
}

// ==================================================
// 4. ดึงข้อมูล Asset และตารางที่เกี่ยวข้อง
// ==================================================
async function getAssetDetail(id) {
  // ใช้ a.* เพื่ออ่านคอลัมน์ที่มีอยู่จริงใน assets
  // ไม่บังคับว่าต้องมี received_date หรือฟิลด์ใหม่ทุกตัว
  const result = await query(
    `
    SELECT
      a.*,
          -- ส่ง DATE เป็น yyyy-mm-dd โดยตรง ไม่แปลงผ่าน JavaScript Date/UTC
          -- ป้องกันวันที่ถอยหนึ่งวันทุกครั้งที่เปิดฟอร์มแล้วบันทึก
          a.received_date::text AS received_date,
          a.purchase_date::text AS purchase_date,
          a.warranty_start::text AS warranty_start,
          a.warranty_end::text AS warranty_end,

      -- ชื่อประเภท Asset
      t.name AS asset_type,

      -- ==================================================
      -- Asset Owner ปัจจุบัน
      --
      -- assets.asset_owner_id เก็บ user.id
      -- เรา JOIN เพื่อเอาชื่อจริงมาใช้ในหน้า Edit
      -- ==================================================
      u.full_name AS asset_owner_name,

      -- เก็บสถานะ Active ของ Owner เดิมไว้ด้วย
      -- เพื่อรู้ว่า Owner คนเดิม Active หรือ Inactive
      u.is_active AS asset_owner_is_active

    FROM public.assets a

    LEFT JOIN public.asset_types t
      ON t.id = a.asset_type_id

    -- ==================================================
    -- "user" ต้องใส่ double quote
    -- เพราะ USER เป็น keyword ของ PostgreSQL
    -- ==================================================
    LEFT JOIN public."user" u
      ON u.id = a.asset_owner_id

    WHERE a.id = $1

    LIMIT 1
  `,
    [id],
  );

  const asset = result.rows[0];

  // ถ้าไม่พบ Asset ให้หน้าแสดง 404
  if (!asset) return null;

  // อ่านข้อมูลเสริมเฉพาะตารางที่มีอยู่จริง
  const [
    assignments,
    technicalRows,
    securityRows,
    documents,
    auditLogs,
    maintenance,
  ] = await Promise.all([
    readOptional(
      "asset_assignments",
      "SELECT *, assigned_date::text AS assigned_date, returned_date::text AS returned_date FROM public.asset_assignments WHERE asset_id = $1 ORDER BY id DESC",
      [id],
    ),
    readOptional(
      "asset_technical",
      "SELECT * FROM public.asset_technical WHERE asset_id = $1 LIMIT 1",
      [id],
    ),
    readOptional(
      "asset_security",
      "SELECT * FROM public.asset_security WHERE asset_id = $1 LIMIT 1",
      [id],
    ),
    readOptional(
      "asset_documents",
      "SELECT * FROM public.asset_documents WHERE asset_id = $1 ORDER BY id DESC",
      [id],
    ),
    readOptional(
      "asset_audit_logs",
      "SELECT * FROM public.asset_audit_logs WHERE asset_id = $1 ORDER BY id DESC LIMIT 20",
      [id],
    ),
    readOptional(
      "asset_maintenance",
      "SELECT * FROM public.asset_maintenance WHERE asset_id = $1 ORDER BY id DESC LIMIT 20",
      [id],
    ),
  ]);

  // รายการที่ยังไม่ได้คืน = ผู้ครอบครองปัจจุบัน
  const currentAssignment =
    assignments?.find((item) => item.returned_date === null) ?? null;

  // ดึงรายชื่อที่เกี่ยวข้องกับ Asset นี้เท่านั้น
  const [people, locations, departments, vendors] = await Promise.all([
    readLookup("user", [
      ...(assignments ?? []).map((item) => item.assigned_to),
    ]),
    readLookup("locations", [
      asset.location_id,
      ...(assignments ?? []).map((item) => item.location_id),
    ]),
    readLookup("departments", [
      asset.owning_department_id,
      ...(assignments ?? []).map((item) => item.department_id),
    ]),
    readLookup("vendors", [asset.vendor_id]),
  ]);

  // สร้าง Map เพื่อค้นหาชื่อจาก ID ได้ง่าย
  const peopleMap = new Map(people.map((p) => [String(p.id), p]));
  const locationMap = new Map(locations.map((l) => [String(l.id), l]));
  const departmentMap = new Map(departments.map((d) => [String(d.id), d]));
  const vendorMap = new Map(vendors.map((v) => [String(v.id), v]));

  return {
    asset,
    assignments,
    currentAssignment,
    technical: technicalRows?.[0] ?? null,
    technicalTableExists: technicalRows !== null,
    security: securityRows?.[0] ?? null,
    securityTableExists: securityRows !== null,
    documents,
    auditLogs,
    maintenance,
    peopleMap,
    locationMap,
    departmentMap,
    vendorMap,
  };
}

// ==================================================
// 5. หน้า Asset Detail
// ==================================================
export default async function AssetDetailPage({ params }) {
  // Next.js 16 รับ params แบบ Promise
  const { id } = await params;
  const session = await auth();
  const canWrite = ["Admin", "IT Staff"].includes(session?.user?.role);

  // รับเฉพาะ ID ตัวเลขบวก ไม่เอาค่าอื่นไป Query
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  let data;

  try {
    data = await getAssetDetail(id);
  } catch (error) {
    console.error("Load asset detail error:", error);

    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <Link href="/assets" className="text-blue-600">
            ← กลับหน้า Assets
          </Link>

          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            ไม่สามารถโหลดข้อมูล Asset Detail ได้ กรุณาตรวจสอบ Terminal
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    notFound();
  }

  const {
    asset,
    assignments,
    currentAssignment,
    technical,
    technicalTableExists,
    security,
    securityTableExists,
    documents,
    auditLogs,
    maintenance,
    peopleMap,
    locationMap,
    departmentMap,
    vendorMap,
  } = data;

  const [activeUsers, availableLocations, databaseDate] = await Promise.all([
    query('SELECT u.id,u.employee_code,u.full_name,d.name AS department_name FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id WHERE u.is_active=true ORDER BY u.full_name,u.id'),
    query('SELECT id,name,building,floor,room FROM public.locations WHERE is_active=true ORDER BY name,id'),
    query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today"),
  ]);

  // Helper แปลง ID เป็นชื่อจริง
  function personName(personId) {
    if (personId == null) return null;
    return (
      peopleMap.get(String(personId))?.full_name ??
      `ไม่พบรายชื่อ (ID ${personId})`
    );
  }

  function departmentName(departmentId) {
    if (departmentId == null) return null;
    return (
      departmentMap.get(String(departmentId))?.name ??
      `ไม่พบแผนก (ID ${departmentId})`
    );
  }

  function locationName(locationId) {
    if (locationId == null) return null;

    const location = locationMap.get(String(locationId));

    if (!location) return `ไม่พบ Location (ID ${locationId})`;

    return [location.name, location.building, location.floor, location.room]
      .filter(Boolean)
      .join(" / ");
  }

  // Owner และ assignee อ้างอิง public."user" แต่เป็นคนละบทบาท
  const ownerName = asset.asset_owner_id == null
    ? "ไม่มี Asset Owner"
    : (asset.asset_owner_name || `Owner ID ${asset.asset_owner_id}`) +
      (asset.asset_owner_is_active === false ? " (Inactive)" : "");

  // ข้อมูลเดิมยังไม่มี Assignment จึงใช้ Owner เป็นผู้ครอบครองชั่วคราวเท่านั้น
  // หลัง Asset มีประวัติ Assignment แล้ว การคืนจะทำให้ผู้ครอบครองเป็นค่าว่าง
  const hasAssignmentHistory = (assignments?.length ?? 0) > 0;
  const currentHolderName = currentAssignment
    ? personName(currentAssignment.assigned_to)
    : !hasAssignmentHistory && asset.asset_owner_id != null
      ? ownerName
      : null;
  const holderSource = currentAssignment
    ? "Assignment"
    : !hasAssignmentHistory && asset.asset_owner_id != null
      ? "Asset Owner (ข้อมูลเดิม)"
      : null;

  const vendorName =
    asset.vendor_id == null
      ? null
      : (vendorMap.get(String(asset.vendor_id))?.name ??
        `ไม่พบ Vendor (ID ${asset.vendor_id})`);

  // Location ปัจจุบันใช้จาก Assignment ก่อน
  // ถ้าไม่มีจึงใช้ Location ที่เก็บใน Asset
  const currentLocationId = currentAssignment?.location_id ?? asset.location_id;

  const currentDepartmentId =
    currentAssignment?.department_id ?? asset.owning_department_id;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* ================= HEADER ================= */}
        <div>
          <Link
            href="/assets"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับหน้า Assets
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            {/* ==================================================
              ข้อมูล Asset ด้านซ้าย
          ================================================== */}
            <div>
              <p className="text-sm text-gray-500">Asset Detail</p>

              <h1 className="mt-1 text-3xl font-bold text-gray-800">
                {asset.asset_code}
              </h1>

              <p className="mt-2 text-gray-600">{asset.asset_name}</p>
            </div>

            {/* ==================================================
              Status + ปุ่ม Edit ด้านขวา
          ================================================== */}
            <div className="flex items-center gap-3">
              {/* สถานะปัจจุบัน */}
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {asset.status}
              </span>

              {/* ================================================
                ไปหน้า Edit ของ Asset ปัจจุบัน

                ตัวอย่าง:
                Asset ID = 12

                URL:
                /assets/12/edit
            ================================================= */}
              {canWrite && (
                <Link
                  href={`/assets/${asset.id}/edit`}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
                >
                  Edit Asset
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* ================= GENERAL ================= */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold">General Information</h2>

          <InfoGrid
            rows={[
              ["รหัสทรัพย์สิน", asset.asset_code],
              ["ประเภทอุปกรณ์", asset.asset_type],
              ["ชื่อทรัพย์สิน", asset.asset_name],
              ["Asset Owner", ownerName],
              ["ยี่ห้อ", asset.brand],
              ["รุ่น", asset.model],
              ["Serial Number", asset.serial_number],
              ["Computer Name", asset.computer_name],
              ["สถานะ", asset.status],
              ["วันที่รับเข้า", formatDate(asset.received_date)],
              ["รายละเอียด", asset.description],
              ["หมายเหตุ", asset.notes],
              ["วันที่สร้างข้อมูล", formatDate(asset.created_at, true)],
              ["วันที่แก้ไขล่าสุด", formatDate(asset.updated_at, true)],
            ]}
          />
        </section>

        {/* ================= ASSIGNMENT ================= */}
        <DetailSection title="Assignment & Location">
          <AssignmentForm
            key={currentAssignment?.id ?? "none"}
            assetId={String(asset.id)}
            assetStatus={asset.status}
            currentId={
              currentAssignment ? String(currentAssignment.id) : null
            }
            currentAssigneeId={currentAssignment?.assigned_to ?? null}
            currentAssignedDate={
              currentAssignment?.assigned_date
                ? String(currentAssignment.assigned_date).slice(0, 10)
                : undefined
            }
            users={activeUsers.rows}
            locations={availableLocations.rows}
            today={databaseDate.rows[0].today}
            canWrite={canWrite}
          />
          <InfoGrid
            rows={[
              ["Asset Owner", ownerName],
              [
                "ผู้ครอบครองปัจจุบัน",
                currentHolderName,
              ],
              ["แหล่งข้อมูลผู้ครอบครอง", holderSource],
              ["แผนก", departmentName(currentDepartmentId)],
              ["Location", locationName(currentLocationId)],
              ["วันที่มอบหมาย", formatDate(currentAssignment?.assigned_date)],
            ]}
          />

          <h3 className="mt-8 mb-3 font-semibold">ประวัติการมอบหมาย</h3>

          {assignments === null ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_assignments
            </p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีประวัติการมอบหมาย</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <InfoGrid
                    rows={[
                      ["ผู้ครอบครอง", personName(item.assigned_to)],
                      ["Location", locationName(item.location_id)],
                      ["แผนก ณ วันที่มอบหมาย", departmentName(item.department_id)],
                      ["วันที่มอบหมาย", formatDate(item.assigned_date)],
                      ["วันที่รับคืน", formatDate(item.returned_date)],
                      ["หมายเหตุการมอบหมาย", item.assignment_notes],
                      ["หมายเหตุการรับคืน", item.return_notes],
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* ================= PURCHASE ================= */}
        <DetailSection title="Purchase & Warranty">
          <InfoGrid
            rows={[
              ["วันที่ซื้อ", formatDate(asset.purchase_date)],
              ["วันที่รับเข้า", formatDate(asset.received_date)],
              ["ราคาซื้อ", formatMoney(asset.purchase_price, asset.currency)],
              ["Vendor", vendorName],
              ["PO Number", asset.po_number],
              ["Invoice Number", asset.invoice_number],
              ["วันเริ่มรับประกัน", formatDate(asset.warranty_start)],
              ["วันสิ้นสุดรับประกัน", formatDate(asset.warranty_end)],
              ["ประเภทการรับประกัน", asset.warranty_type],
              ["Cost Center", asset.cost_center],
            ]}
          />
        </DetailSection>

        {/* ================= TECHNICAL ================= */}
        <DetailSection title="Technical Information">
          {!technicalTableExists ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_technical
            </p>
          ) : !technical ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีข้อมูล Technical สำหรับ Asset นี้
            </p>
          ) : (
            <InfoGrid
              rows={[
                ["Hostname", technical.hostname],
                ["IP Address", technical.ip_address],
                ["MAC Address", technical.mac_address],
                ["Operating System", technical.operating_system],
                ["CPU", technical.cpu],
                ["RAM (GB)", technical.ram_gb],
                ["Storage (GB)", technical.storage_gb],
                ["BIOS / Firmware", technical.bios_firmware],
                ["VLAN", technical.vlan],
                ["Management IP", technical.management_ip],
                ["Rack", technical.rack],
                ["Rack U", technical.rack_u],
                [
                  "Screen Size",
                  technical.extra_specs?.screenSize ??
                    technical.extra_specs?.screen_size,
                ],
                ["Resolution", technical.extra_specs?.resolution],
              ]}
            />
          )}
        </DetailSection>

        {/* ================= SECURITY ================= */}
        <DetailSection title="Security / Compliance">
          {!securityTableExists ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_security
            </p>
          ) : !security ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีข้อมูล Security สำหรับ Asset นี้
            </p>
          ) : (
            <InfoGrid
              rows={[
                ["Encryption Enabled", security.encryption_enabled],
                ["Encryption Type", security.encryption_type],
                ["Antivirus / EDR", security.antivirus_edr],
                [
                  "Last Security Check",
                  formatDate(security.last_security_check),
                ],
                ["Patch Status", security.patch_status],
                ["Local Admin Policy", security.local_admin_policy],
                ["Data Classification", security.data_classification],
                ["Last Asset Check", formatDate(security.last_asset_check)],
                ["Security Notes", security.security_notes],
              ]}
            />
          )}
        </DetailSection>

        {/* ================= DOCUMENTS & HISTORY ================= */}
        <DetailSection title="Documents & History">
          <h3 className="mb-3 font-semibold">เอกสาร</h3>

          {documents === null ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_documents
            </p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีเอกสาร</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border p-3">
                  <p className="font-medium">{doc.file_name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {display(doc.document_type)} ·{" "}
                    {formatDate(doc.created_at, true)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-8 mb-3 font-semibold">ประวัติการซ่อมบำรุง</h3>

          {maintenance === null ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_maintenance
            </p>
          ) : maintenance.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีประวัติการซ่อมบำรุง</p>
          ) : (
            <div className="space-y-3">
              {maintenance.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <InfoGrid
                    rows={[
                      ["ประเภท", item.maintenance_type],
                      ["รายละเอียด", item.description],
                      ["สถานะ", item.status],
                      ["วันที่แจ้ง", formatDate(item.reported_at, true)],
                      ["วันที่เสร็จ", formatDate(item.completed_at, true)],
                      ["ค่าใช้จ่าย", formatMoney(item.cost)],
                    ]}
                  />
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-8 mb-3 font-semibold">Audit History</h3>

          {auditLogs === null ? (
            <p className="text-sm text-gray-500">
              ยังไม่มีตาราง asset_audit_logs
            </p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีประวัติ Audit</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {display(log.action)} · {display(log.table_name)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatDate(log.created_at, true)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    </main>
  );
}
