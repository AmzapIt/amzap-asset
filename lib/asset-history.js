import { query } from './db.js';
import { AssetWorkflowError, workflowId } from './asset-scan.js';

export const historyFields = {
  asset_name: 'ชื่อ Asset', brand: 'ยี่ห้อ', model: 'รุ่น', serial_number: 'Serial Number',
  computer_name: 'Computer Name', description: 'รายละเอียด', status: 'สถานะ',
  received_date: 'วันที่รับเข้า', purchase_date: 'วันที่ซื้อ', purchase_price: 'ราคาซื้อ',
  po_number: 'PO Number', invoice_number: 'Invoice Number', warranty_start: 'เริ่มประกัน',
  warranty_end: 'สิ้นสุดประกัน', warranty_type: 'ประเภทประกัน', cost_center: 'Cost Center',
  notes: 'หมายเหตุ', vendor_id: 'Vendor ID',
};
const comparable = (value) => value instanceof Date ? value.toISOString().slice(0,10) : value == null ? null : String(value);
export function assetChanges(before, after) {
  return Object.entries(historyFields).flatMap(([key,label]) => comparable(before?.[key]) === comparable(after?.[key])
    ? [] : [{ field: label, before: comparable(before?.[key]), after: comparable(after?.[key]) }]);
}

export function parseAssetDisposalReason(nextStatus, currentStatus, value) {
  if (nextStatus !== 'Disposed' || currentStatus === 'Disposed') return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000) {
    throw new AssetWorkflowError('กรุณาระบุเหตุผลการจำหน่าย (ไม่เกิน 1,000 ตัวอักษร)');
  }
  return value.trim();
}

export async function recordAssetEdit(client, assetId, accountId, before, after, eventReason = null) {
  const changes = assetChanges(before,after);
  if (!changes.length) return;
  const newValues = eventReason ? { ...after, event_reason: eventReason } : after;
  await client.query(`INSERT INTO public.asset_audit_logs
    (asset_id,record_id,table_name,action,old_values,new_values,changed_by_account_id)
    VALUES ($1,$1,'assets','EDIT',$2::jsonb,$3::jsonb,$4)`,
  [assetId,JSON.stringify(before),JSON.stringify(newValues),accountId]);
}

export async function getAssetHistory(assetId, cursor = null, db = { query }) {
  workflowId(assetId);
  let afterTime = null, afterKey = null;
  if (cursor) {
    try {
      if (typeof cursor !== 'string' || cursor.length > 500) throw new Error();
      const decoded = JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
      if (typeof decoded.time !== 'string' || !Number.isFinite(Date.parse(decoded.time)) ||
        typeof decoded.key !== 'string' || !/^[a-z_]+:[1-9]\d*$/.test(decoded.key)) throw new Error();
      afterTime = decoded.time; afterKey = decoded.key;
    } catch { throw new AssetWorkflowError('ตำแหน่งประวัติไม่ถูกต้อง'); }
  }
  const rows = (await db.query(`WITH events AS (
    SELECT 'created:'||a.id AS event_key,'created' AS kind,'สร้างข้อมูล Asset' AS title,
      a.created_at AS occurred_at,created_by.display_name AS actor,
      jsonb_build_object('รหัส Asset',a.asset_code) AS details,NULL::jsonb AS old_values,NULL::jsonb AS new_values
    FROM public.assets a
    LEFT JOIN LATERAL (
      SELECT received_by_account_id FROM public.asset_stock_receipts
      WHERE asset_id=a.id AND receipt_type='new' ORDER BY id LIMIT 1
    ) initial_receipt ON true
    LEFT JOIN public.app_accounts created_by ON created_by.id=initial_receipt.received_by_account_id
    WHERE a.id=$1
    UNION ALL
    SELECT 'receipt:'||r.id,'receipt',CASE WHEN r.receipt_type='new' THEN 'รับเครื่องใหม่เข้าคลัง IT' ELSE 'รับคืนเข้าคลัง IT' END,
      r.created_at,account.display_name,jsonb_build_object(
        'วันที่รับ',r.receipt_date::text,'ผู้ส่งคืน',NULLIF(concat_ws(' ',u.full_name,
          CASE WHEN NULLIF(btrim(u.nickname),'') IS NOT NULL THEN '('||u.nickname||')' END),''),
        'สภาพ',CASE WHEN r.asset_condition='ready' THEN 'พร้อมใช้' ELSE 'รอซ่อม' END,'เหตุผล',r.reason),NULL,NULL
    FROM public.asset_stock_receipts r
    LEFT JOIN public.app_accounts account ON account.id=r.received_by_account_id
    LEFT JOIN public."user" u ON u.id=r.returned_by_user_id WHERE r.asset_id=$1
    UNION ALL
    SELECT 'assignment:'||s.id,'assignment','เบิก / มอบหมายให้พนักงาน',s.created_at,
      COALESCE(account.display_name,actor_user.full_name),jsonb_build_object(
        'วันที่มอบหมาย',s.assigned_date::text,'พนักงาน',concat_ws(' ',u.full_name,
          CASE WHEN NULLIF(btrim(u.nickname),'') IS NOT NULL THEN '('||u.nickname||')' END),
        'สถานที่',location.name,'หมายเหตุ',s.assignment_notes),NULL,NULL
    FROM public.asset_assignments s
    LEFT JOIN public."user" u ON u.id=s.assigned_to
    LEFT JOIN public.locations location ON location.id=s.location_id
    LEFT JOIN LATERAL (SELECT * FROM public.asset_audit_logs log
      WHERE log.asset_id=s.asset_id AND log.action='ISSUE' AND log.new_values->>'assignment_id'=s.id::text
      ORDER BY log.id DESC LIMIT 1) log ON true
    LEFT JOIN public.app_accounts account ON account.id=log.changed_by_account_id
    LEFT JOIN public."user" actor_user ON actor_user.id=log.changed_by WHERE s.asset_id=$1
    UNION ALL
    SELECT 'legacy_return:'||s.id,'receipt','รับคืน (ประวัติเดิม)',s.returned_date AT TIME ZONE 'Asia/Bangkok',NULL,
      jsonb_build_object('วันที่รับคืน',s.returned_date::text,'พนักงาน',u.full_name,'หมายเหตุ',s.return_notes),NULL,NULL
    FROM public.asset_assignments s LEFT JOIN public."user" u ON u.id=s.assigned_to
    WHERE s.asset_id=$1 AND s.returned_date IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.asset_stock_receipts r WHERE r.from_assignment_id=s.id)
    UNION ALL
    SELECT 'movement:'||m.id,'movement','ย้ายสถานที่ / เปลี่ยน Owner หรือแผนก',m.created_at,account.display_name,
      jsonb_build_object('วันที่ย้าย',m.movement_date::text,'เหตุผล',m.reason,'หมายเหตุ',m.notes,
        'สถานที่',CASE WHEN m.from_location_id IS DISTINCT FROM m.to_location_id THEN COALESCE(fl.name,'ไม่ระบุ')||' → '||COALESCE(tl.name,'ไม่ระบุ') END,
        'Owner',CASE WHEN m.from_owner_id IS DISTINCT FROM m.to_owner_id THEN COALESCE(fu.full_name,'ไม่มี')||' → '||COALESCE(tu.full_name,'ไม่มี') END,
        'แผนก',CASE WHEN m.from_department_id IS DISTINCT FROM m.to_department_id THEN COALESCE(fd.name,'ไม่ระบุ')||' → '||COALESCE(td.name,'ไม่ระบุ') END),NULL,NULL
    FROM public.asset_movements m
    LEFT JOIN public.locations fl ON fl.id=m.from_location_id LEFT JOIN public.locations tl ON tl.id=m.to_location_id
    LEFT JOIN public."user" fu ON fu.id=m.from_owner_id LEFT JOIN public."user" tu ON tu.id=m.to_owner_id
    LEFT JOIN public.departments fd ON fd.id=m.from_department_id LEFT JOIN public.departments td ON td.id=m.to_department_id
    LEFT JOIN public.app_accounts account ON account.id=m.changed_by_account_id WHERE m.asset_id=$1
    UNION ALL
    SELECT 'document:'||d.id,'photo',CASE WHEN d.document_type='Asset Photo' THEN 'เพิ่มรูป Asset' ELSE 'เพิ่มเอกสาร' END,
      d.created_at,COALESCE(account.display_name,u.full_name),jsonb_build_object('ชื่อไฟล์',d.file_name,'ประเภท',d.document_type),NULL,NULL
    FROM public.asset_documents d
    LEFT JOIN public.app_accounts account ON account.id=d.uploaded_by_account_id
    LEFT JOIN public."user" u ON u.id=d.uploaded_by WHERE d.asset_id=$1
    UNION ALL
    SELECT 'maintenance:'||m.id,'maintenance','ซ่อมบำรุง',m.created_at,account.display_name,
      jsonb_build_object('ประเภท',m.maintenance_type,'รายละเอียด',m.description,'สถานะ',m.status,
        'วันที่แจ้ง',to_char(m.reported_at AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD'),
        'วันที่ส่งซ่อม',m.sent_at::text,'ร้าน / ผู้รับซ่อม',m.sent_to,
        'กำหนดรับคืน',m.expected_return_at::text,
        'วันที่เสร็จ',to_char(m.completed_at AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD'),'หมายเหตุ',m.notes),NULL,NULL
    FROM public.asset_maintenance m LEFT JOIN public.app_accounts account ON account.id=m.recorded_by_account_id WHERE m.asset_id=$1
    UNION ALL
    SELECT 'print:'||p.id,'print',CASE WHEN b.source='existing' THEN 'ยืนยันสติ๊กเกอร์เดิม' ELSE 'พิมพ์สติ๊กเกอร์' END,
      p.printed_at,account.display_name,jsonb_build_object('รหัสบนสติ๊กเกอร์',p.asset_code),NULL,NULL
    FROM public.asset_label_prints p JOIN public.asset_label_print_batches b ON b.id=p.batch_id
    LEFT JOIN public.app_accounts account ON account.id=b.printed_by_account_id WHERE p.asset_id=$1
    UNION ALL
    SELECT 'audit:'||log.id,
      CASE WHEN log.action='EDIT' AND log.new_values->>'status'='Disposed'
        AND log.old_values->>'status' IS DISTINCT FROM log.new_values->>'status'
        THEN 'disposal' ELSE 'audit' END,
      CASE log.action WHEN 'REPAIR_READY' THEN 'ซ่อมเสร็จ / พร้อมเบิก'
      WHEN 'EDIT' THEN CASE WHEN log.new_values->>'status'='Disposed'
          AND log.old_values->>'status' IS DISTINCT FROM log.new_values->>'status'
        THEN 'จำหน่าย Asset'
        WHEN log.old_values->>'status' IS DISTINCT FROM log.new_values->>'status'
        THEN 'เปลี่ยนสถานะ Asset' ELSE 'แก้ไขข้อมูล Asset' END
      ELSE 'บันทึกการเปลี่ยนแปลง: '||log.action END,
      log.created_at,COALESCE(account.display_name,u.full_name),
      jsonb_build_object('ผลการซ่อม',log.new_values->>'repair_result',
        'เหตุผล',COALESCE(log.new_values->>'event_reason',log.new_values->>'reason'),
        'วันที่ทำรายการ',log.new_values->>'date'),log.old_values,log.new_values
    FROM public.asset_audit_logs log
    LEFT JOIN public.app_accounts account ON account.id=log.changed_by_account_id
    LEFT JOIN public."user" u ON u.id=log.changed_by
    WHERE log.asset_id=$1 AND log.action NOT IN ('ISSUE','RETURN')
    UNION ALL
    SELECT 'count:'||e.id,'count','ตรวจนับ Asset',e.created_at,account.display_name,
      jsonb_build_object('รอบตรวจนับ',s.name,'ผล',CASE e.result WHEN 'found' THEN 'พบแล้ว / ตรงกับข้อมูล'
        WHEN 'mismatch' THEN 'ข้อมูลไม่ตรง' ELSE 'ไม่พบ' END,
        'สถานที่ที่พบ',e.observed_location_name,'ผู้ถือที่พบ',e.observed_holder_name,'หมายเหตุ',e.notes),NULL,NULL
    FROM public.asset_count_events e
    JOIN public.asset_count_items i ON i.id=e.item_id JOIN public.asset_count_sessions s ON s.id=i.session_id
    LEFT JOIN public.app_accounts account ON account.id=e.checked_by_account_id WHERE i.asset_id=$1
  ) SELECT *,to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time
    FROM events WHERE ($2::timestamptz IS NULL OR (occurred_at,event_key)<($2::timestamptz,$3::text))
    ORDER BY occurred_at DESC,event_key DESC LIMIT 51`,[assetId,afterTime,afterKey])).rows;
  const hasMore = rows.length > 50;
  const page = rows.slice(0,50);
  const last = page.at(-1);
  return { events: page.map(({event_key,kind,title,occurred_at,actor,details,old_values,new_values}) => ({event_key,kind,title,occurred_at,actor,details,changes: assetChanges(old_values,new_values)})),
    nextCursor: hasMore ? Buffer.from(JSON.stringify({time:last.cursor_time,key:last.event_key})).toString('base64url') : null };
}
