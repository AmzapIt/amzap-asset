import { query } from "./db.js";
import { formatUserDisplayName } from "./user-display.js";

// ความเคลื่อนไหวล่าสุดของ Dashboard: รับเครื่องใหม่ / รับคืน / เบิก / ย้าย
// ตัวเลขสรุปอื่นคำนวณจาก getReportAssets ใน lib/dashboard-summary.js
export async function getRecentActivity(limit = 8) {
  const rows = (await query(
    `SELECT e.kind, e.asset_id::text, a.asset_code, t.name AS asset_type,
            e.full_name, e.nickname, e.place,
            to_char(e.created_at AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI') AS at
       FROM (
         SELECT CASE WHEN r.receipt_type='new' THEN 'new' ELSE 'return' END AS kind, r.asset_id,
                u.full_name, u.nickname, NULL::text AS place, r.created_at, r.id
           FROM public.asset_stock_receipts r
           LEFT JOIN public."user" u ON u.id=r.returned_by_user_id
         UNION ALL
         SELECT 'issue', s.asset_id, u.full_name, u.nickname, l.name, s.created_at, s.id
           FROM public.asset_assignments s
           LEFT JOIN public."user" u ON u.id=s.assigned_to
           LEFT JOIN public.locations l ON l.id=s.location_id
         UNION ALL
         SELECT 'move', m.asset_id, NULL, NULL,
                CASE WHEN m.from_location_id IS DISTINCT FROM m.to_location_id
                  THEN COALESCE(fl.name,'ไม่ระบุ')||' → '||COALESCE(tl.name,'ไม่ระบุ') END,
                m.created_at, m.id
           FROM public.asset_movements m
           LEFT JOIN public.locations fl ON fl.id=m.from_location_id
           LEFT JOIN public.locations tl ON tl.id=m.to_location_id
       ) e
       JOIN public.assets a ON a.id=e.asset_id
       LEFT JOIN public.asset_types t ON t.id=a.asset_type_id
      ORDER BY e.created_at DESC, e.kind, e.id DESC
      LIMIT $1`,
    [limit],
  )).rows;
  return rows.map(({ full_name, nickname, ...row }) => ({
    ...row,
    person: full_name ? formatUserDisplayName({ full_name, nickname }) : null,
  }));
}
