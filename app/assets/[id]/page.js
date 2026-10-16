import AssignmentForm from "./AssignmentForm";
import MovementForm from "./MovementForm";
import AssetActivity from "../AssetActivity";
import AssetPhotoLinks from "./AssetPhotoLinks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { formatUserDisplayName } from "@/lib/user-display";
import { isViewableAssetDocumentUrl } from "@/lib/asset-photo-links";

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

function movementTransition(fromId, toId, fromName, toName) {
  const unchanged =
    fromId == null && toId == null
      ? true
      : String(fromId) === String(toId);

  if (unchanged) return null;

  return `${fromName || "ไม่ระบุ"} → ${toName || "ไม่ระบุ"}`;
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
      <summary className="cursor-pointer px-4 py-4 font-semibold text-gray-800 sm:px-6 sm:py-5">
        {title}
      </summary>

      <div className="border-t px-4 py-4 sm:px-6 sm:py-5">{children}</div>
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
      registration_site.site_code AS registration_site_code,
      registration_site.name AS registration_site_name,

      -- ==================================================
      -- Asset Owner อ้างอิง public."user" ผ่าน assets.asset_owner_id
      -- JOIN เพื่อแสดงชื่อพนักงานในหน้า Asset Detail
      -- ไม่กรอง is_active เพื่อให้ข้อมูล Owner เดิมยังแสดงในประวัติได้
      -- ==================================================
      u.full_name AS asset_owner_name,
      u.nickname AS asset_owner_nickname,

      -- เก็บสถานะ Active ของ Owner เดิมไว้ด้วย
      -- เพื่อรู้ว่า Owner คนเดิม Active หรือ Inactive
      u.is_active AS asset_owner_is_active

    FROM public.assets a

    LEFT JOIN public.asset_types t
      ON t.id = a.asset_type_id

    LEFT JOIN public.asset_registration_sites registration_site
      ON registration_site.id = a.registration_site_id

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
    movements,
    stockReceipts,
    legacyHolderExclusions,
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
    readOptional(
      "asset_movements",
      `SELECT
         movement.id,
         movement.movement_date::text AS movement_date,
         movement.from_location_id,
         movement.to_location_id,
         movement.from_department_id,
         movement.to_department_id,
         movement.from_owner_id,
         movement.to_owner_id,
         movement.reason,
         movement.notes,
         movement.created_at,
         from_location.name AS from_location_name,
         to_location.name AS to_location_name,
         from_department.name AS from_department_name,
         to_department.name AS to_department_name,
         from_owner.full_name AS from_owner_name,
         from_owner.nickname AS from_owner_nickname,
         to_owner.full_name AS to_owner_name,
         to_owner.nickname AS to_owner_nickname,
         account.display_name AS changed_by_name
       FROM public.asset_movements movement
       LEFT JOIN public.locations from_location ON from_location.id=movement.from_location_id
       LEFT JOIN public.locations to_location ON to_location.id=movement.to_location_id
       LEFT JOIN public.departments from_department ON from_department.id=movement.from_department_id
       LEFT JOIN public.departments to_department ON to_department.id=movement.to_department_id
       LEFT JOIN public."user" from_owner ON from_owner.id=movement.from_owner_id
       LEFT JOIN public."user" to_owner ON to_owner.id=movement.to_owner_id
       LEFT JOIN public.app_accounts account ON account.id=movement.changed_by_account_id
       WHERE movement.asset_id=$1
       ORDER BY movement.movement_date DESC, movement.id DESC
       LIMIT 100`,
      [id],
    ),
    readOptional(
      "asset_stock_receipts",
      `SELECT receipt.id,receipt.receipt_type,receipt.receipt_date::text AS receipt_date,
              receipt.asset_condition,receipt.reason,receipt.created_at,
              returned_by.full_name AS returned_by_name,returned_by.nickname AS returned_by_nickname,
              account.display_name AS received_by_name
       FROM public.asset_stock_receipts receipt
       LEFT JOIN public."user" returned_by ON returned_by.id=receipt.returned_by_user_id
       LEFT JOIN public.app_accounts account ON account.id=receipt.received_by_account_id
       WHERE receipt.asset_id=$1
       ORDER BY receipt.receipt_date DESC,receipt.id DESC`,
      [id],
    ),
    readOptional(
      "employee_offboarding_items",
      `SELECT item.id
       FROM public.employee_offboarding_items item
       JOIN public.employee_offboardings offboarding ON offboarding.id=item.offboarding_id
       WHERE item.asset_id=$1 AND item.resolution='not_held'
         AND offboarding.user_id=$2
       LIMIT 1`,
      [id, asset.asset_owner_id],
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
    movements,
    stockReceipts,
    legacyHolderExcluded: Boolean(legacyHolderExclusions?.length),
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
    movements,
    stockReceipts,
    legacyHolderExcluded,
    peopleMap,
    locationMap,
    departmentMap,
    vendorMap,
  } = data;

  const photoLinks = (documents ?? [])
    .filter((doc) => doc.document_type === "Asset Photo" && isViewableAssetDocumentUrl(doc.storage_path))
    .sort((a, b) => Number(Boolean(b.is_primary_photo)) - Number(Boolean(a.is_primary_photo)))
    .map((doc) => ({
      id: String(doc.id),
      url: doc.storage_path,
      isPrimary: Boolean(doc.is_primary_photo),
    }));

  const [activeUsers, availableLocations, availableDepartments, databaseDate, itStockSettings] = await Promise.all([
    query(
      `SELECT u.id,u.employee_code,u.full_name,u.nickname,u.is_active,u.location_id,
              d.name AS department_name,l.name AS location_name
       FROM public."user" u
       LEFT JOIN public.departments d ON d.id=u.department_id
       LEFT JOIN public.locations l ON l.id=u.location_id
       WHERE $2::boolean OR u.is_active=true OR u.id=$1
       ORDER BY u.full_name,u.id`,
      [asset.asset_owner_id, !currentAssignment && asset.status === "In Use"],
    ),
    query(
      `SELECT id,name,building,floor,room,is_active
       FROM public.locations
       WHERE is_active=true OR id=$1
       ORDER BY name,id`,
      [asset.location_id],
    ),
    query(
      `SELECT id,name,is_active
       FROM public.departments
       WHERE is_active=true OR id=$1
       ORDER BY name,id`,
      [asset.owning_department_id],
    ),
    query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today"),
    query("SELECT it_stock_location_id FROM public.asset_inventory_settings WHERE singleton=true"),
  ]);

  // Helper แปลง ID เป็นชื่อสำหรับแสดงผล โดยชื่อเล่นไม่ถูกใช้เป็นค่าบันทึก
  function personName(personId) {
    if (personId == null) return null;
    const person = peopleMap.get(String(personId));

    return person
      ? formatUserDisplayName(person)
      : `ไม่พบรายชื่อ (ID ${personId})`;
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

  // Asset Owner ของรายการใหม่จะตรงกับผู้ครอบครองใน Assignment
  const ownerName = asset.asset_owner_id == null
    ? "ไม่มี Asset Owner"
    : (formatUserDisplayName({
        full_name: asset.asset_owner_name,
        nickname: asset.asset_owner_nickname,
      }) || `Owner ID ${asset.asset_owner_id}`) +
      (asset.asset_owner_is_active === false ? " (Inactive)" : "");

  // ข้อมูลเดิมยังไม่มี Assignment จึงใช้ Owner เป็นผู้ครอบครองชั่วคราวเท่านั้น
  // หลัง Asset มีประวัติ Assignment แล้ว การคืนจะทำให้ผู้ครอบครองเป็นค่าว่าง
  const hasAssignmentHistory = (assignments?.length ?? 0) > 0;
  const currentHolderName = currentAssignment
    ? personName(currentAssignment.assigned_to)
    : !hasAssignmentHistory && !legacyHolderExcluded && asset.status === "In Use" && asset.asset_owner_id != null
      ? ownerName
      : null;
  const holderSource = currentAssignment
    ? "Assignment"
    : !hasAssignmentHistory && !legacyHolderExcluded && asset.status === "In Use" && asset.asset_owner_id != null
      ? "Asset Owner (ข้อมูลเดิม)"
      : null;

  const vendorName =
    asset.vendor_id == null
      ? null
      : (vendorMap.get(String(asset.vendor_id))?.name ??
        `ไม่พบ Vendor (ID ${asset.vendor_id})`);

  // assets เก็บ Location และ Owning Department ปัจจุบัน ส่วน Assignment
  // เก็บ snapshot ณ วันที่มอบหมายเพื่อไม่ให้ Movement เขียนทับประวัติเดิม
  const currentLocationId = asset.location_id;
  const currentDepartmentId = asset.owning_department_id;

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
        {canWrite && (
          <section id="asset-action" className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">ดำเนินการ Asset</h2>
            <p className="mt-1 text-sm text-slate-600">
              สถานะ {asset.status} · ผู้ครอบครอง {currentHolderName || "ไม่มี"} · Location {locationName(currentLocationId) || "ไม่ระบุ"}
            </p>
            <AssignmentForm
              key={[currentAssignment?.id ?? "none", asset.status, asset.location_id ?? "none"].join("-")}
              assetId={String(asset.id)}
              assetStatus={asset.status}
              assetLocationId={asset.location_id}
              itStockLocationId={itStockSettings.rows[0]?.it_stock_location_id ?? null}
              currentId={currentAssignment ? String(currentAssignment.id) : null}
              currentAssignedDate={currentAssignment?.assigned_date
                ? String(currentAssignment.assigned_date).slice(0, 10)
                : undefined}
              users={activeUsers.rows}
              locations={availableLocations.rows}
              today={databaseDate.rows[0].today}
              canWrite={canWrite}
            />
          </section>
        )}
        {/* ================= GENERAL ================= */}
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-6 text-lg font-semibold">General Information</h2>

          <InfoGrid
            rows={[
              ["รหัสทรัพย์สิน", asset.asset_code],
              [
                "สถานที่ขึ้นทะเบียน",
                asset.registration_site_code && asset.registration_site_name
                  ? `${asset.registration_site_code} — ${asset.registration_site_name}`
                  : "ยังไม่ได้กำหนด",
              ],
              [
                "รหัสเดิม",
                asset.history_assets,
              ],
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
          <AssetPhotoLinks assetId={String(asset.id)} photos={photoLinks} canWrite={canWrite} />
        </section>

        <AssetActivity assetId={String(asset.id)} canWrite={canWrite} />

        {/* ================= ASSIGNMENT ================= */}
        <DetailSection title="ผู้ครอบครองและประวัติการมอบหมาย">
          <InfoGrid
            rows={[
              ["Asset Owner", ownerName],
              [
                "ผู้ครอบครองปัจจุบัน",
                currentHolderName,
              ],
              ["แหล่งข้อมูลผู้ครอบครอง", holderSource],
              ["Owning Department", departmentName(currentDepartmentId)],
              ["Current Location", locationName(currentLocationId)],
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

        <DetailSection title="ประวัติรับเข้าคลัง IT">
          {!stockReceipts?.length ? (
            <p className="text-sm text-slate-500">ยังไม่มีประวัติรับเข้าคลัง IT ในระบบ</p>
          ) : (
            <div className="space-y-3">
              {stockReceipts.map((receipt) => (
                <div key={receipt.id} className="rounded-lg border p-4">
                  <InfoGrid rows={[
                    ["รายการ", receipt.receipt_type === "new" ? "รับเครื่องใหม่" : "รับคืนจากพนักงาน"],
                    ["วันที่รับ", formatDate(receipt.receipt_date)],
                    ["ผู้ส่งคืน", formatUserDisplayName({
                      full_name: receipt.returned_by_name,
                      nickname: receipt.returned_by_nickname,
                    })],
                    ["สภาพ", receipt.asset_condition === "ready" ? "พร้อมใช้" : "รอซ่อม"],
                    ["เหตุผล", receipt.reason],
                    ["IT ผู้รับ", receipt.received_by_name],
                  ]} />
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* Movement changes asset master data; Assignment history remains intact. */}
        <DetailSection title="แก้ไขข้อมูลพิเศษ / Asset Movement">
          <MovementForm
            key={[
              asset.location_id ?? "none",
              asset.owning_department_id ?? "none",
              asset.asset_owner_id ?? "none",
            ].join("-")}
            assetId={String(asset.id)}
            currentLocationId={asset.location_id}
            currentDepartmentId={asset.owning_department_id}
            currentOwnerId={asset.asset_owner_id}
            currentOwnerName={ownerName}
            assetStatus={asset.status}
            itStockLocationId={itStockSettings.rows[0]?.it_stock_location_id ?? null}
            locations={availableLocations.rows}
            departments={availableDepartments.rows}
            today={databaseDate.rows[0].today}
            canWrite={canWrite}
          />

          <h3 className="mb-3 font-semibold">ประวัติการโอนย้าย</h3>

          {movements === null ? (
            <p className="text-sm text-amber-700">
              ยังไม่มีตาราง asset_movements กรุณารัน Migration 015
            </p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีประวัติ Asset Movement</p>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const changedRows = [
                  [
                    "Location",
                    movementTransition(
                      movement.from_location_id,
                      movement.to_location_id,
                      movement.from_location_name,
                      movement.to_location_name,
                    ),
                  ],
                  [
                    "Owning Department",
                    movementTransition(
                      movement.from_department_id,
                      movement.to_department_id,
                      movement.from_department_name,
                      movement.to_department_name,
                    ),
                  ],
                  [
                    "Asset Owner",
                    movementTransition(
                      movement.from_owner_id,
                      movement.to_owner_id,
                      formatUserDisplayName({
                        full_name: movement.from_owner_name,
                        nickname: movement.from_owner_nickname,
                      }),
                      formatUserDisplayName({
                        full_name: movement.to_owner_name,
                        nickname: movement.to_owner_nickname,
                      }),
                    ),
                  ],
                ].filter(([, value]) => value);

                return (
                  <article key={movement.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {formatDate(movement.movement_date)} · {movement.reason}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          บันทึกโดย {movement.changed_by_name || "บัญชีที่ถูกลบ"} · {formatDate(movement.created_at, true)}
                        </p>
                      </div>
                    </div>
                    <InfoGrid rows={changedRows} />
                    {movement.notes && (
                      <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        {movement.notes}
                      </p>
                    )}
                  </article>
                );
              })}
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
                  {typeof doc.storage_path === "string" &&
                  isViewableAssetDocumentUrl(doc.storage_path) ? (
                    <a
                      href={doc.storage_path}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {doc.file_name}
                    </a>
                  ) : (
                    <p className="font-medium">{doc.file_name}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    {display(doc.document_type)} ·{" "}
                    {formatDate(doc.created_at, true)}
                    {doc.is_primary_photo ? " · รูปหลัก" : ""}
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
                      ["วันที่ส่งซ่อม", formatDate(item.sent_at)],
                      ["ร้าน / ผู้รับซ่อม", item.sent_to],
                      ["กำหนดรับคืน", formatDate(item.expected_return_at)],
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
                  {log.action === "REPAIR_READY" && log.new_values?.repair_result && (
                    <p className="mt-1 text-sm text-slate-700">
                      ผลการซ่อม / ตรวจเช็ก: {log.new_values.repair_result}
                      {log.new_values.date ? ` · วันที่ ${formatDate(log.new_values.date)}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    </main>
  );
}
