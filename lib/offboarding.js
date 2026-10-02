import { getDbPool } from "./db.js";

export class OffboardingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function id(value) {
  const text = String(value ?? "");
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw new OffboardingError("Invalid ID");
  }
  return text;
}

async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function startOffboarding(userId, actorId, pool = getDbPool()) {
  userId = id(userId);
  actorId = id(actorId);
  return transaction(pool, async (client) => {
    // Accessory issues/returns use this same transaction lock. Take it before
    // the employee row lock so the snapshot cannot race an in-flight transfer.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('accessory-inventory',0))");
    const employee = (await client.query(
      'SELECT id,is_active FROM public."user" WHERE id=$1 FOR UPDATE',
      [userId],
    )).rows[0];
    if (!employee) throw new OffboardingError("ไม่พบพนักงาน", 404);
    const existing = (await client.query(
      "SELECT id FROM public.employee_offboardings WHERE user_id=$1 AND closed_at IS NULL FOR UPDATE",
      [userId],
    )).rows[0];
    if (existing) {
      if (employee.is_active) throw new OffboardingError("มีเคสลาออกเดิมที่ยังไม่ปิด กรุณาตรวจสอบก่อน", 409);
      return { id: String(existing.id), alreadyStarted: true };
    }
    // User row lock serializes with new Asset/Accessory issues.
    await client.query('UPDATE public."user" SET is_active=false WHERE id=$1', [userId]);
    const offboarding = (await client.query(
      "INSERT INTO public.employee_offboardings (user_id,started_by_account_id) VALUES ($1,$2) RETURNING id",
      [userId, actorId],
    )).rows[0];
    await client.query(
      "INSERT INTO public.employee_offboarding_items " +
      "(offboarding_id,item_type,asset_id,assignment_id,expected_quantity,requires_review) " +
      "SELECT $1,'asset',asset.id,current_assignment.id,1,(current_assignment.id IS NULL) " +
      "FROM public.assets asset LEFT JOIN LATERAL (" +
      " SELECT assignment.id,assignment.assigned_to FROM public.asset_assignments assignment " +
      " WHERE assignment.asset_id=asset.id AND assignment.returned_date IS NULL " +
      " ORDER BY assignment.assigned_date DESC,assignment.id DESC LIMIT 1" +
      ") current_assignment ON true " +
      "WHERE current_assignment.assigned_to=$2 OR (" +
      " current_assignment.id IS NULL AND asset.asset_owner_id=$2 AND asset.status='In Use' " +
      " AND NOT EXISTS (SELECT 1 FROM public.asset_assignments history WHERE history.asset_id=asset.id)" +
      " AND NOT EXISTS (SELECT 1 FROM public.employee_offboarding_items prior_item " +
      " JOIN public.employee_offboardings prior ON prior.id=prior_item.offboarding_id " +
      " WHERE prior_item.asset_id=asset.id AND prior_item.resolution='not_held' AND prior.user_id=$2))",
      [offboarding.id, userId],
    );
    await client.query(
      "INSERT INTO public.employee_offboarding_items " +
      "(offboarding_id,item_type,employee_accessory_id,expected_quantity,returned_quantity_at_start) " +
      "SELECT $1,'accessory',holding.id, " +
      "holding.quantity-holding.returned_quantity-holding.transferred_quantity-holding.disposed_quantity, " +
      "holding.returned_quantity FROM public.employee_accessories holding " +
      "WHERE holding.user_id=$2 AND holding.returned_date IS NULL " +
      "AND holding.quantity-holding.returned_quantity-holding.transferred_quantity-holding.disposed_quantity>0",
      [offboarding.id, userId],
    );
    return { id: String(offboarding.id), alreadyStarted: false };
  });
}

export async function getOffboardingOverview(userId, pool = getDbPool()) {
  userId = id(userId);
  const offboarding = (await pool.query(
    "SELECT id::text,user_id::text,started_at,closed_at " +
    "FROM public.employee_offboardings WHERE user_id=$1 ORDER BY id DESC LIMIT 1",
    [userId],
  )).rows[0];
  if (!offboarding) return null;
  const items = (await pool.query(
    "SELECT progress.id::text,progress.item_type,progress.asset_id::text, " +
    "progress.assignment_id::text,progress.employee_accessory_id::text, " +
    "progress.expected_quantity,progress.received_quantity,progress.pending_quantity, " +
    "progress.requires_review,progress.resolution,progress.resolution_reason, " +
    "asset.asset_code,asset.asset_name,asset.brand AS asset_brand,asset.model AS asset_model, " +
    "asset.serial_number AS asset_serial,accessory_type.name AS accessory_type, " +
    "accessory.brand AS accessory_brand,accessory.model AS accessory_model, " +
    "accessory.serial_number AS accessory_serial " +
    "FROM public.employee_offboarding_item_progress progress " +
    "LEFT JOIN public.assets asset ON asset.id=progress.asset_id " +
    "LEFT JOIN public.employee_accessories accessory ON accessory.id=progress.employee_accessory_id " +
    "LEFT JOIN public.accessory_types accessory_type ON accessory_type.id=accessory.accessory_type_id " +
    "WHERE progress.offboarding_id=$1 ORDER BY progress.item_type,progress.id",
    [offboarding.id],
  )).rows;
  return {
    ...offboarding,
    items,
    pendingItems: items.filter((item) => item.pending_quantity > 0).length,
    pendingQuantity: items.reduce((total, item) => total + item.pending_quantity, 0),
    reviewItems: items.filter((item) => item.pending_quantity > 0 && item.requires_review).length,
  };
}

export async function getOffboardingSummaries(pool = getDbPool()) {
  const result = await pool.query(
    "WITH latest AS (SELECT DISTINCT ON (user_id) id,user_id,closed_at " +
    "FROM public.employee_offboardings ORDER BY user_id,id DESC) " +
    "SELECT latest.user_id::text AS user_id,latest.id::text AS offboarding_id,latest.closed_at, " +
    "count(progress.id) FILTER (WHERE progress.pending_quantity>0)::int AS pending_items, " +
    "coalesce(sum(progress.pending_quantity),0)::int AS pending_quantity, " +
    "count(progress.id) FILTER (WHERE progress.pending_quantity>0 AND progress.requires_review)::int AS review_items " +
    "FROM latest LEFT JOIN public.employee_offboarding_item_progress progress " +
    "ON progress.offboarding_id=latest.id " +
    "GROUP BY latest.id,latest.user_id,latest.closed_at",
  );
  return new Map(result.rows.map((row) => [row.user_id, row]));
}

export async function dismissLegacyOffboardingItem(userId, itemId, reason, actorId, pool = getDbPool()) {
  userId = id(userId);
  itemId = id(itemId);
  actorId = id(actorId);
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) {
    throw new OffboardingError("กรุณาระบุเหตุผลที่รายการนี้ไม่ใช่ของพนักงาน (ไม่เกิน 1,000 ตัวอักษร)");
  }
  return transaction(pool, async (client) => {
    const item = (await client.query(
      "SELECT item.id,item.requires_review,item.resolution " +
      "FROM public.employee_offboarding_items item " +
      "JOIN public.employee_offboardings offboarding ON offboarding.id=item.offboarding_id " +
      "WHERE item.id=$1 AND offboarding.user_id=$2 AND offboarding.closed_at IS NULL FOR UPDATE OF item",
      [itemId, userId],
    )).rows[0];
    if (!item) throw new OffboardingError("ไม่พบรายการในเคสลาออกที่เปิดอยู่", 404);
    if (!item.requires_review || item.resolution) {
      throw new OffboardingError("รายการนี้ไม่สามารถยืนยันว่าไม่ใช่ของพนักงานได้", 409);
    }
    const progress = (await client.query(
      "SELECT received_quantity FROM public.employee_offboarding_item_progress WHERE id=$1",
      [itemId],
    )).rows[0];
    if (progress.received_quantity > 0) throw new OffboardingError("รายการนี้มีการรับคืนแล้ว", 409);
    await client.query(
      "UPDATE public.employee_offboarding_items " +
      "SET resolution='not_held',resolution_reason=$2,resolved_at=now(),resolved_by_account_id=$3 WHERE id=$1",
      [itemId, reason.trim(), actorId],
    );
    return { id: itemId };
  });
}

export async function closeOffboarding(userId, actorId, pool = getDbPool()) {
  userId = id(userId);
  actorId = id(actorId);
  return transaction(pool, async (client) => {
    const offboarding = (await client.query(
      "SELECT id FROM public.employee_offboardings WHERE user_id=$1 AND closed_at IS NULL FOR UPDATE",
      [userId],
    )).rows[0];
    if (!offboarding) throw new OffboardingError("ไม่มีเคสลาออกที่เปิดอยู่", 404);
    const pending = (await client.query(
      "SELECT count(*)::int AS count FROM public.employee_offboarding_item_progress " +
      "WHERE offboarding_id=$1 AND pending_quantity>0",
      [offboarding.id],
    )).rows[0].count;
    if (pending) throw new OffboardingError("ยังมีอุปกรณ์ที่ต้องคืนหรือตรวจสอบ", 409);
    await client.query(
      "UPDATE public.employee_offboardings SET closed_at=now(),closed_by_account_id=$2 WHERE id=$1",
      [offboarding.id, actorId],
    );
    return { id: String(offboarding.id) };
  });
}
