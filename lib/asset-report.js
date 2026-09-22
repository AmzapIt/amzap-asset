import { query } from "./db.js";

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
  return (await query(`SELECT a.id::text AS id,a.asset_code,a.asset_name,a.brand,a.model,
    a.serial_number,a.status,a.purchase_price,a.currency,a.notes,
    a.received_date::text AS received_date,a.warranty_end::text AS warranty_end,
    t.name AS asset_type,
    u.full_name AS owner_name,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN p.full_name
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) THEN u.full_name
      ELSE NULL
    END AS current_holder,
    CASE
      WHEN aa.assigned_to IS NOT NULL THEN 'Assignment'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history
        WHERE history.asset_id=a.id
      ) AND a.asset_owner_id IS NOT NULL
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
    LEFT JOIN public.locations l ON l.id=COALESCE(aa.location_id,a.location_id)
    LEFT JOIN public.departments d ON d.id=a.owning_department_id
    WHERE ($1::bigint[] IS NULL OR a.id=ANY($1::bigint[]))
    ORDER BY a.id DESC`,[ids])).rows;
}

// อ่านพนักงานที่เลือกสำหรับใบรับมอบ พร้อมแผนกและตำแหน่งจริงจากฐานข้อมูล
// ไม่กรอง Active เพื่อรองรับเอกสารคืนอุปกรณ์ของพนักงาน Inactive ด้วย
// การอ่านผู้รับมอบเพื่อพิมพ์เอกสารไม่ได้เปลี่ยน assignment ของอุปกรณ์
export async function getRecipient(id) {
  return (await query(`SELECT u.id::text AS id,u.full_name,u.employee_code,u."position",d.name AS department
    FROM public."user" u LEFT JOIN public.departments d ON d.id=u.department_id WHERE u.id=$1`,[id])).rows[0];
}
