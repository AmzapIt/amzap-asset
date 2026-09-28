import { query } from "./db.js";

// One SQL statement gives every widget the same database snapshot. Aggregate
// assignments/maintenance before joining so history never multiplies asset counts.
/**
 * อ่านสรุป Dashboard จาก PostgreSQL ในคำสั่งเดียว เพื่อให้ทุกการ์ดเห็นข้อมูลชุดเดียวกัน
 * base: เตรียมข้อมูลหนึ่งแถวต่อ Asset; groups: นับตามสถานะ ประเภท และ Owner
 * status_type_counts: นับจำนวน Asset แบบไขว้ระหว่างสถานะกับประเภท
 * EXISTS ใช้ตรวจงานซ่อมค้าง จึงนับ Asset เพียงครั้งเดียวแม้มีหลายงานซ่อม
 * ประกันใกล้หมดนับตั้งแต่วันนี้ถึงอีก 30 วัน รวมวันปลายทาง ตามเวลา Asia/Bangkok
 * ตัวเลข Count นับทุกรายการ แต่ตารางติดตามส่งมาไม่เกิน 10 แถวต่อหมวด
 * missingOwner ตรวจ asset_owner_id ที่ยังว่าง
 * COALESCE ของ JSON คืน [] เมื่อไม่มีข้อมูล เพื่อให้หน้าเว็บเรียก map/filter ได้
 */
export async function getDashboard() {
  const result = await query(`
    WITH base AS (
      SELECT a.id::text AS id,a.asset_code,a.asset_name,a.status,a.created_at,
        a.warranty_end::text AS warranty_end,
        a.warranty_end BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
          AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date + 30 AS warranty_due,
        a.asset_type_id::text AS type_id,COALESCE(t.name,'ไม่ระบุ') AS type_name,
        a.asset_owner_id::text AS owner_id,
        COALESCE(u.full_name,'ไม่ระบุ') AS owner_name,
        u.nickname AS owner_nickname,
        EXISTS(SELECT 1 FROM public.asset_maintenance m WHERE m.asset_id=a.id
          AND m.status IN ('Open','In Progress')) AS maintenance_open
      FROM public.assets a
      LEFT JOIN public.asset_types t ON t.id=a.asset_type_id
      LEFT JOIN public."user" u ON u.id=a.asset_owner_id
    ), groups AS (
      SELECT 'status' AS kind,status AS key,status AS label,count(*)::int AS count FROM base GROUP BY status
      UNION ALL SELECT 'type',type_id,type_name,count(*)::int FROM base GROUP BY type_id,type_name
      UNION ALL
      SELECT
        'owner',
        owner_id,
        CASE
          WHEN owner_id IS NULL THEN 'ไม่ระบุ'
          WHEN NULLIF(BTRIM(owner_nickname),'') IS NOT NULL
            THEN owner_name || ' (' || BTRIM(owner_nickname) || ')'
          ELSE owner_name
        END,
        count(*)::int
      FROM base
      GROUP BY owner_id,owner_name,owner_nickname
    ), status_type_counts AS (
      SELECT
        status,
        type_id,
        type_name,
        count(*)::int AS count
      FROM base
      GROUP BY status,type_id,type_name
    )
    SELECT jsonb_build_object(
      'total',(SELECT count(*) FROM base),
      'inUse',(SELECT count(*) FROM base WHERE status='In Use'),
      'inStock',(SELECT count(*) FROM base WHERE status IN ('In Stock','Spare')),
      'repair',(SELECT count(*) FROM base WHERE status='Repair'),
      'groups',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY kind,count DESC,label,key) FROM groups g),'[]'::jsonb),
      'statusTypeCounts',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY type_name,type_id,status) FROM status_type_counts s),'[]'::jsonb),
      'warrantyCount',(SELECT count(*) FROM base WHERE warranty_due),
      'maintenanceCount',(SELECT count(*) FROM base WHERE maintenance_open),
      'missingOwnerCount',(SELECT count(*) FROM base WHERE owner_id IS NULL),
      'warranty',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM base WHERE warranty_due ORDER BY warranty_end,id LIMIT 10) x),'[]'::jsonb),
      'maintenance',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM base WHERE maintenance_open ORDER BY created_at DESC,id LIMIT 10) x),'[]'::jsonb),
      'missingOwner',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM base WHERE owner_id IS NULL ORDER BY created_at DESC,id LIMIT 10) x),'[]'::jsonb),
      'recent',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM base ORDER BY created_at DESC,id LIMIT 10) x),'[]'::jsonb)
    ) AS dashboard
  `);
  return result.rows[0].dashboard;
}
