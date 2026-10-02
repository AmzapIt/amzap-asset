import { query, getDbPool } from "./db.js";
import { formatUserDisplayName } from "./user-display.js";

// Shared by the asset list and exports: owner and current holder remain separate.
// IDs remain strings, preserving PostgreSQL bigint precision.
/**
 * แหล่งข้อมูลร่วมของหน้า Asset List และ Export เพื่อให้ชื่อและสถานที่ใช้กติกาเดียวกัน
 * ids = null อ่านทั้งหมด; ถ้าส่ง array จะอ่านเฉพาะ ID ที่เลือกด้วย parameter $1
 * owner_name: ชื่อ Owner ผ่าน asset_owner_id
 * ใช้เฉพาะ assignment ที่ยังไม่คืน; ถ้าไม่มีจะได้ null และหน้าจอแสดง "-"
 * current_holder ใช้ Assignment ที่ยังไม่คืนก่อน และใช้ Owner เฉพาะข้อมูลเดิมที่ไม่เคยมี Assignment
 * LATERAL LIMIT 1 ป้องกันประวัติการมอบหมายหลายแถวทำให้ Asset ซ้ำในรายงาน
 * DATE และ bigint ส่งเป็นข้อความ เพื่อไม่เลื่อนวันจาก timezone หรือเสียความแม่นยำของ ID
 */
export async function getReportAssets(ids = null) {
  return (await query(`SELECT a.id::text AS id,a.asset_code,
    a.history_assets AS legacy_asset_codes,a.asset_name,a.brand,a.model,
    a.serial_number,a.status,a.purchase_price,a.currency,a.notes,
    a.received_date::text AS received_date,a.warranty_end::text AS warranty_end,
    EXISTS (
      SELECT 1
      FROM public.asset_documents photo
      WHERE photo.asset_id=a.id
        AND photo.document_type='Asset Photo'
    ) AS has_photo,
    t.name AS asset_type,
    a.asset_owner_id::text AS owner_id,
    u.full_name AS owner_name,
    u.nickname AS owner_nickname,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN aa.assigned_to::text
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) AND a.status='In Use' AND NOT legacy_exclusion.excluded THEN a.asset_owner_id::text
      ELSE NULL
    END AS current_holder_id,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN p.full_name
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) AND a.status='In Use' AND NOT legacy_exclusion.excluded THEN u.full_name
      ELSE NULL
    END AS current_holder,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN p.nickname
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) AND a.status='In Use' AND NOT legacy_exclusion.excluded THEN u.nickname
      ELSE NULL
    END AS current_holder_nickname,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN 'Assignment'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) AND a.asset_owner_id IS NOT NULL AND a.status='In Use'
        AND NOT legacy_exclusion.excluded
        THEN 'Asset Owner (legacy)'
      ELSE NULL
    END AS holder_source,
    l.name AS location,d.name AS department
    FROM public.assets a
    LEFT JOIN public.asset_types t ON t.id=a.asset_type_id
    LEFT JOIN public."user" u ON u.id=a.asset_owner_id
    LEFT JOIN LATERAL (SELECT assigned_to,location_id FROM public.asset_assignments
      WHERE asset_id=a.id AND returned_date IS NULL ORDER BY assigned_date DESC,id DESC LIMIT 1) aa ON true
    LEFT JOIN public."user" p ON p.id=aa.assigned_to
    LEFT JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1
        FROM public.employee_offboarding_items item
        JOIN public.employee_offboardings offboarding ON offboarding.id=item.offboarding_id
        WHERE item.asset_id=a.id AND item.resolution='not_held'
          AND offboarding.user_id=a.asset_owner_id
      ) AS excluded
    ) legacy_exclusion ON true
    -- assets.location_id is the current physical location. Assignment keeps
    -- its own historical snapshot and must not hide a later Movement.
    LEFT JOIN public.locations l ON l.id=a.location_id
    LEFT JOIN public.departments d ON d.id=a.owning_department_id
    WHERE ($1::bigint[] IS NULL OR a.id=ANY($1::bigint[]))
    ORDER BY a.id DESC`,[ids])).rows.map((asset) => ({
      ...asset,
      // ชื่อเล่นใช้แสดงผลเท่านั้น owner_id/current_holder_id ยังคงเป็นค่าที่ใช้อ้างอิงจริง
      owner_name: formatUserDisplayName({
        full_name: asset.owner_name,
        nickname: asset.owner_nickname,
      }) || null,
      current_holder: formatUserDisplayName({
        full_name: asset.current_holder,
        nickname: asset.current_holder_nickname,
      }) || null,
    }));
}

// อ่านพนักงานที่เลือกสำหรับใบรับมอบ พร้อมแผนกและตำแหน่งจริงจากฐานข้อมูล
// ไม่กรอง Active เพื่อรองรับเอกสารคืนอุปกรณ์ของพนักงาน Inactive ด้วย
// การอ่านผู้รับมอบเพื่อพิมพ์เอกสารไม่ได้เปลี่ยน assignment ของอุปกรณ์
export async function getRecipient(id) {
  return (await query(`SELECT u.id::text AS id,u.full_name,u.nickname,u.employee_code,u."position",d.name AS department
    FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id WHERE u.id=$1`,[id])).rows[0];
}

// Accessory ไม่มี Asset Code และใช้ employee_accessories เป็นแหล่งข้อมูลหลัก
// userId = null ใช้สำหรับ preview หน้า Report; ตอนสร้าง PDF จะระบุ userId
// และอ่านจากฐานข้อมูลใหม่อีกครั้งเพื่อไม่เชื่อข้อมูลที่ค้างอยู่ใน Browser
export async function getCurrentAccessories(userId = null, pool = getDbPool()) {
  return (
    await pool.query(
      `SELECT
         ea.id::text AS id,
         ea.user_id::text AS user_id,
         at.name AS accessory_type,
         ea.quantity-ea.returned_quantity-ea.transferred_quantity-ea.disposed_quantity AS quantity,
         ea.brand,
         ea.model,
         ea.serial_number,
         ea.issued_date::text AS issued_date,
         ea.notes
       FROM public.employee_accessories ea
       INNER JOIN public.accessory_types at
         ON at.id=ea.accessory_type_id
       WHERE ea.returned_date IS NULL
         AND ea.quantity>ea.returned_quantity+ea.transferred_quantity+ea.disposed_quantity
         AND ($1::bigint IS NULL OR ea.user_id=$1)
       ORDER BY at.name,ea.issued_date,ea.id`,
      [userId],
    )
  ).rows;
}
