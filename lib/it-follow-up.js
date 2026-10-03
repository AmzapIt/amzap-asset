import { query } from './db.js';

export const REPAIR_FOLLOW_UP_DAYS = 7;

export async function getItFollowUp(db = { query }) {
  const result = await db.query(`
    WITH latest_open_offboarding AS (
      SELECT DISTINCT ON (user_id) id,user_id,started_at
      FROM public.employee_offboardings
      WHERE closed_at IS NULL
      ORDER BY user_id,id DESC
    ), pending_offboarding AS (
      SELECT offboarding.user_id::text AS user_id,
        offboarding.id::text AS offboarding_id,
        offboarding.started_at,
        employee.employee_code,employee.full_name,employee.nickname,
        count(progress.id) FILTER (WHERE progress.pending_quantity>0)::int AS pending_items,
        coalesce(sum(progress.pending_quantity),0)::int AS pending_quantity,
        count(progress.id) FILTER (
          WHERE progress.pending_quantity>0 AND progress.requires_review
        )::int AS review_items
      FROM latest_open_offboarding offboarding
      JOIN public."user" employee ON employee.id=offboarding.user_id
      JOIN public.employee_offboarding_item_progress progress
        ON progress.offboarding_id=offboarding.id
      GROUP BY offboarding.user_id,offboarding.id,offboarding.started_at,
        employee.employee_code,employee.full_name,employee.nickname
      HAVING count(progress.id) FILTER (WHERE progress.pending_quantity>0)>0
    ), latest_return AS (
      SELECT DISTINCT ON (receipt.asset_id) receipt.*
      FROM public.asset_stock_receipts receipt
      WHERE receipt.receipt_type='return'
      ORDER BY receipt.asset_id,receipt.created_at DESC,receipt.id DESC
    ), unprocessed_returns AS (
      SELECT asset.id::text AS asset_id,asset.asset_code,asset.asset_name,
        receipt.id::text AS receipt_id,receipt.receipt_date::text AS receipt_date,
        receipt.created_at,receipt.reason,receipt.asset_condition,
        employee.full_name AS returned_by_name,employee.nickname AS returned_by_nickname,
        account.display_name AS received_by_name,
        location.name AS location_name
      FROM latest_return receipt
      JOIN public.assets asset ON asset.id=receipt.asset_id
      LEFT JOIN public."user" employee ON employee.id=receipt.returned_by_user_id
      LEFT JOIN public.app_accounts account ON account.id=receipt.received_by_account_id
      LEFT JOIN public.locations location ON location.id=asset.location_id
      WHERE receipt.asset_condition='repair' AND asset.status='Repair'
        AND NOT EXISTS (
          SELECT 1 FROM public.asset_maintenance maintenance
          WHERE maintenance.asset_id=asset.id AND maintenance.created_at>=receipt.created_at
        )
    ), open_repair AS (
      SELECT DISTINCT ON (maintenance.asset_id)
        maintenance.asset_id::text AS asset_id,maintenance.id::text AS maintenance_id,
        maintenance.maintenance_type,maintenance.description,maintenance.status,
        (maintenance.reported_at AT TIME ZONE 'Asia/Bangkok')::date::text AS reported_date,
        maintenance.sent_at::text AS sent_date,maintenance.sent_to,
        maintenance.expected_return_at::text AS expected_return_date,
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date -
          (maintenance.reported_at AT TIME ZONE 'Asia/Bangkok')::date)::int AS age_days,
        asset.asset_code,asset.asset_name,asset.status AS asset_status
      FROM public.asset_maintenance maintenance
      JOIN public.assets asset ON asset.id=maintenance.asset_id
      WHERE maintenance.status IN ('Open','In Progress') AND asset.status='Repair'
      ORDER BY maintenance.asset_id,maintenance.reported_at ASC,maintenance.id ASC
    ), waiting_repair AS (
      SELECT asset.id::text AS asset_id,asset.asset_code,asset.asset_name,asset.status,
        location.name AS location_name,
        COALESCE(latest_receipt.created_at,asset.updated_at,asset.created_at) AS waiting_since
      FROM public.assets asset
      LEFT JOIN public.locations location ON location.id=asset.location_id
      LEFT JOIN LATERAL (
        SELECT receipt.created_at FROM public.asset_stock_receipts receipt
        WHERE receipt.asset_id=asset.id AND receipt.asset_condition='repair'
        ORDER BY receipt.created_at DESC,receipt.id DESC LIMIT 1
      ) latest_receipt ON true
      WHERE asset.status='Repair'
        AND NOT EXISTS (SELECT 1 FROM open_repair repair WHERE repair.asset_id=asset.id::text)
        AND NOT EXISTS (SELECT 1 FROM unprocessed_returns returned WHERE returned.asset_id=asset.id::text)
    )
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at) FROM pending_offboarding x),'[]'::jsonb) AS offboarding,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.asset_code) FROM unprocessed_returns x),'[]'::jsonb) AS unprocessed_returns,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.waiting_since,x.asset_code) FROM waiting_repair x),'[]'::jsonb) AS waiting_repair,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.age_days DESC,x.asset_code) FROM open_repair x WHERE x.age_days>$1),'[]'::jsonb) AS long_repairs
  `, [REPAIR_FOLLOW_UP_DAYS]);

  return result.rows[0];
}
