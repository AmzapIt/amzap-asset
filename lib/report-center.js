import { query } from './db.js';

export async function getCustodyReport(db = { query }) {
  const result = await db.query(`
    WITH custody_periods AS (
      SELECT 'assignment:'||assignment.id::text AS id,
        assignment.asset_id::text AS asset_id,asset.asset_code,asset.asset_name,
        assignment.assigned_to::text AS holder_id,holder_user.full_name AS holder_name,
        holder_user.nickname AS holder_nickname,department.name AS department_name,
        location.name AS location_name,assignment.assigned_date::text AS assigned_date,
        COALESCE(issue_actor.display_name,issue_user.full_name) AS issue_actor,
        assignment.assignment_notes AS issue_reason,
        assignment.returned_date::text AS returned_date,
        COALESCE(receipt.reason,assignment.return_notes) AS return_reason,
        returner.full_name AS returned_by_name,returner.nickname AS returned_by_nickname,
        return_actor.display_name AS return_actor,
        CASE WHEN assignment.returned_date IS NULL THEN 'current' ELSE 'returned' END AS period_status,
        'Assignment'::text AS source
      FROM public.asset_assignments assignment
      JOIN public.assets asset ON asset.id=assignment.asset_id
      JOIN public."user" holder_user ON holder_user.id=assignment.assigned_to
      LEFT JOIN public.departments department ON department.id=assignment.department_id
      LEFT JOIN public.locations location ON location.id=assignment.location_id
      LEFT JOIN LATERAL (
        SELECT log.changed_by_account_id,log.changed_by
        FROM public.asset_audit_logs log
        WHERE log.asset_id=assignment.asset_id AND log.action='ISSUE'
          AND log.new_values->>'assignment_id'=assignment.id::text
        ORDER BY log.id DESC LIMIT 1
      ) issue_log ON true
      LEFT JOIN public.app_accounts issue_actor ON issue_actor.id=issue_log.changed_by_account_id
      LEFT JOIN public."user" issue_user ON issue_user.id=issue_log.changed_by
      LEFT JOIN LATERAL (
        SELECT receipt.reason,receipt.returned_by_user_id,receipt.received_by_account_id
        FROM public.asset_stock_receipts receipt
        WHERE receipt.from_assignment_id=assignment.id AND receipt.receipt_type='return'
        ORDER BY receipt.id DESC LIMIT 1
      ) receipt ON true
      LEFT JOIN public."user" returner ON returner.id=receipt.returned_by_user_id
      LEFT JOIN public.app_accounts return_actor ON return_actor.id=receipt.received_by_account_id
      UNION ALL

      SELECT 'legacy-holder:'||asset.id::text,asset.id::text,asset.asset_code,asset.asset_name,
        holder.id::text,holder_user.full_name,holder_user.nickname,
        department.name,location.name,NULL::text,NULL::text,NULL::text,NULL::text,
        NULL::text,NULL::text,NULL::text,NULL::text,'current','Legacy Owner'
      FROM public.assets asset
      LEFT JOIN public."user" holder_user ON holder_user.id=asset.asset_owner_id
      LEFT JOIN public.departments department ON department.id=asset.owning_department_id
      LEFT JOIN public.locations location ON location.id=asset.location_id
      ${legacyHolderJoins}
      WHERE asset.status='In Use' AND assignment.id IS NULL AND holder.id IS NOT NULL

      UNION ALL

      SELECT 'receipt:'||receipt.id::text,asset.id::text,asset.asset_code,asset.asset_name,
        receipt.returned_by_user_id::text,returner.full_name,returner.nickname,
        department.name,location.name,NULL::text,NULL::text,NULL::text,
        receipt.receipt_date::text,receipt.reason,returner.full_name,returner.nickname,
        return_actor.display_name,'returned','Return without assignment'
      FROM public.asset_stock_receipts receipt
      JOIN public.assets asset ON asset.id=receipt.asset_id
      LEFT JOIN public."user" returner ON returner.id=receipt.returned_by_user_id
      LEFT JOIN public.app_accounts return_actor ON return_actor.id=receipt.received_by_account_id
      LEFT JOIN public.departments department ON department.id=asset.owning_department_id
      LEFT JOIN public.locations location ON location.id=asset.location_id
      WHERE receipt.receipt_type='return' AND receipt.from_assignment_id IS NULL
    )
    SELECT id,asset_id,asset_code,asset_name,holder_id,
      CASE WHEN NULLIF(btrim(holder_nickname),'') IS NULL THEN holder_name
        ELSE holder_name||' ('||btrim(holder_nickname)||')' END AS holder_name,
      department_name,location_name,assigned_date,issue_actor,issue_reason,
      returned_date,return_reason,
      CASE WHEN NULLIF(btrim(returned_by_nickname),'') IS NULL THEN returned_by_name
        ELSE returned_by_name||' ('||btrim(returned_by_nickname)||')' END AS returned_by_name,
      return_actor,period_status,source
    FROM custody_periods
    ORDER BY COALESCE(returned_date,assigned_date) DESC NULLS LAST,asset_code,id
  `);
  return result.rows;
}

const legacyHolderJoins = `
  LEFT JOIN LATERAL (
    SELECT id,assigned_to FROM public.asset_assignments
    WHERE asset_id=asset.id AND returned_date IS NULL
    ORDER BY assigned_date DESC,id DESC LIMIT 1
  ) assignment ON true
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN assignment.assigned_to IS NOT NULL THEN assignment.assigned_to
      WHEN asset.status='In Use' AND NOT EXISTS (
        SELECT 1 FROM public.asset_assignments history WHERE history.asset_id=asset.id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.employee_offboarding_items item
        JOIN public.employee_offboardings offboarding ON offboarding.id=item.offboarding_id
        WHERE item.asset_id=asset.id AND item.resolution='not_held'
          AND offboarding.user_id=asset.asset_owner_id
      ) THEN asset.asset_owner_id ELSE NULL END AS id
  ) holder ON true`;

export async function getOffboardingPendingReport(db = { query }) {
  const result = await db.query(`
    SELECT offboarding.id::text AS offboarding_id,
      offboarding.user_id::text AS user_id,offboarding.started_at,
      employee.employee_code,employee.full_name,employee.nickname,
      department.name AS department_name,actor.display_name AS started_by,
      item.id::text AS item_id,item.item_type,item.expected_quantity,
      item.received_quantity,item.pending_quantity,item.requires_review,
      item.resolution_reason,
      asset.id::text AS asset_id,asset.asset_code,asset.asset_name,
      accessory_type.name AS accessory_type,accessory.brand AS accessory_brand,
      accessory.model AS accessory_model,accessory.serial_number AS accessory_serial
    FROM public.employee_offboardings offboarding
    JOIN public."user" employee ON employee.id=offboarding.user_id
    JOIN public.employee_offboarding_item_progress item
      ON item.offboarding_id=offboarding.id AND item.pending_quantity>0
    LEFT JOIN public.departments department ON department.id=employee.department_id
    LEFT JOIN public.app_accounts actor ON actor.id=offboarding.started_by_account_id
    LEFT JOIN public.assets asset ON asset.id=item.asset_id
    LEFT JOIN public.employee_accessories accessory ON accessory.id=item.employee_accessory_id
    LEFT JOIN public.accessory_types accessory_type ON accessory_type.id=accessory.accessory_type_id
    WHERE offboarding.closed_at IS NULL
    ORDER BY offboarding.started_at,employee.full_name,item.item_type,item.id
  `);
  return result.rows.map((row) => ({
    ...row,
    employee_name: row.nickname?.trim()
      ? `${row.full_name} (${row.nickname.trim()})`
      : row.full_name,
    item_name: row.item_type === 'asset'
      ? `${row.asset_code || 'Asset'} · ${row.asset_name || 'ไม่ระบุชื่อ'}`
      : [row.accessory_type, row.accessory_brand, row.accessory_model, row.accessory_serial]
        .filter(Boolean).join(' · '),
  }));
}
