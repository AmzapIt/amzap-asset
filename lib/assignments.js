import { getDbPool } from "./db.js";
import { getItStockLocation } from "./it-stock.js";

export class AssignmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (message, status) => { throw new AssignmentError(message, status); };

function id(value, optional = false) {
  if (optional && (value == null || value === "")) return null;
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) fail("Invalid ID");
  return value;
}

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) fail("Invalid date");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("Invalid date");
  return value;
}

function notes(value) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > 10000) fail("Notes must be text, at most 10,000 characters");
  return value.trim() || null;
}

function reason(value, label = "เหตุผลการรับคืน") {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 1000) {
    fail(`กรุณาระบุ${label} (ไม่เกิน 1,000 ตัวอักษร)`);
  }
  return value.trim();
}

async function logCustodyChange(client, assetId, accountId, action, before, after) {
  await client.query(
    `INSERT INTO public.asset_audit_logs
      (asset_id,record_id,table_name,action,old_values,new_values,changed_by,changed_by_account_id)
     VALUES ($1,$1,'assets',$2,$3::jsonb,$4::jsonb,
       (SELECT user_id FROM public.app_accounts WHERE id=$5),$5)`,
    [assetId, action, JSON.stringify(before), JSON.stringify(after), accountId],
  );
}

// Asset code and registered site never change during a physical hand-off.
// Employee-to-employee transfer requires two transactions: return, then issue.
export async function changeAssignment(assetId, body, accountId, pool = getDbPool()) {
  id(assetId);
  id(accountId);
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid request");
  const { action } = body;
  if (!["assign", "return", "ready"].includes(action)) fail("กรุณารับคืนเข้าคลัง IT ก่อนมอบหมายให้พนักงานคนใหม่");

  const eventDate = date(body.date);
  const assignedTo = action === "assign" ? id(body.assignedTo) : null;
  const locationId = action === "assign" ? id(body.locationId) : null;
  const expected = id(body.expectedAssignmentId, true);
  const assignmentNotes = action === "assign" ? notes(body.assignmentNotes) : null;
  const returnReason = action === "return" ? reason(body.returnReason) : null;
  const readyReason = action === "ready" ? reason(body.readyReason, "ผลการซ่อม") : null;
  const returnCondition = action === "return" ? body.returnCondition : null;
  if (action === "return" && !["ready", "repair"].includes(returnCondition)) fail("กรุณาระบุสภาพเครื่องที่รับคืน");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asset = (await client.query(
      "SELECT id,status,location_id,asset_owner_id FROM public.assets WHERE id=$1 FOR UPDATE",
      [assetId],
    )).rows[0];
    if (!asset) fail("Asset not found", 404);
    const current = (await client.query(
      "SELECT *,assigned_date::text AS assigned_date FROM public.asset_assignments WHERE asset_id=$1 AND returned_date IS NULL FOR UPDATE",
      [assetId],
    )).rows[0];
    if ((current?.id == null ? null : String(current.id)) !== expected) fail("Assignment changed. Refresh and try again.", 409);

    const today = (await client.query(
      "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today",
    )).rows[0].today;
    if (eventDate > today) fail("Future assignments/returns are not supported");
    if (current && eventDate < current.assigned_date) fail("Return date cannot precede assignment date");
    const latest = (await client.query(
      "SELECT max(returned_date)::text AS date FROM public.asset_assignments WHERE asset_id=$1",
      [assetId],
    )).rows[0].date;
    if (latest && eventDate < latest) fail("Date cannot precede previous return");
    const latestReceipt = (await client.query(
      "SELECT max(receipt_date)::text AS date FROM public.asset_stock_receipts WHERE asset_id=$1",
      [assetId],
    )).rows[0].date;
    if (latestReceipt && eventDate < latestReceipt) fail("Date cannot precede previous IT stock receipt");

    const itStock = await getItStockLocation(client);
    const before = {
      status: asset.status,
      location_id: asset.location_id,
      asset_owner_id: asset.asset_owner_id,
    };
    if (action === "ready") {
      if (current || asset.status !== "Repair" || String(asset.location_id) !== String(itStock.id)) {
        fail("เครื่องต้องอยู่สถานะ Repair ในคลัง IT และไม่มีผู้ครอบครองก่อนบันทึกว่าพร้อมเบิก", 409);
      }
      await client.query(
        "UPDATE public.assets SET status='In Stock',asset_owner_id=NULL WHERE id=$1",
        [assetId],
      );
      await logCustodyChange(client, assetId, accountId, "REPAIR_READY", before, {
        status: "In Stock", location_id: itStock.id, asset_owner_id: null,
        repair_result: readyReason, date: eventDate,
      });
      await client.query("COMMIT");
      return null;
    }
    if (action === "assign") {
      if (current) fail("Asset is already assigned", 409);
      if (asset.status !== "In Stock" || String(asset.location_id) !== String(itStock.id)) {
        fail("ต้องรับ Asset เข้าคลัง IT และมีสถานะ In Stock ก่อนมอบหมาย", 409);
      }
      if (locationId === String(itStock.id)) fail("เลือก Location ปลายทางของพนักงาน ไม่ใช่คลัง IT");
      const user = (await client.query(
        'SELECT id,department_id FROM public."user" WHERE id=$1 AND is_active=true FOR SHARE',
        [assignedTo],
      )).rows[0];
      if (!user) fail("Assignee must be an active employee");
      if (!(await client.query(
        "SELECT id FROM public.locations WHERE id=$1 AND is_active FOR SHARE",
        [locationId],
      )).rowCount) fail("Location not found");
      const assignment = (await client.query(
        "INSERT INTO public.asset_assignments(asset_id,assigned_to,department_id,location_id,assigned_date,assignment_notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [assetId, assignedTo, user.department_id, locationId, eventDate, assignmentNotes],
      )).rows[0];
      await client.query(
        "UPDATE public.assets SET status='In Use',location_id=$2,asset_owner_id=$3 WHERE id=$1",
        [assetId, locationId, assignedTo],
      );
      await logCustodyChange(client, assetId, accountId, "ISSUE", before, {
        status: "In Use", location_id: locationId, asset_owner_id: assignedTo,
        assignment_id: assignment.id, date: eventDate,
      });
      await client.query("COMMIT");
      return assignment;
    }

    // Legacy In Use records have no Assignment. Never guess the returner from Asset Owner.
    if (!current && asset.status !== "In Use") fail("Asset has no current assignment to return", 409);
    const returnedBy = current ? String(current.assigned_to) : id(body.returnedByUserId);
    if (!current && !(await client.query(
      'SELECT id FROM public."user" WHERE id=$1 FOR SHARE',
      [returnedBy],
    )).rowCount) fail("ไม่พบพนักงานผู้ส่งคืน");
    if (current) {
      await client.query(
        "UPDATE public.asset_assignments SET returned_date=$1,return_notes=$2 WHERE id=$3",
        [eventDate, returnReason, current.id],
      );
    }
    await client.query(
      "UPDATE public.assets SET status=$2,location_id=$3,asset_owner_id=NULL WHERE id=$1",
      [assetId, returnCondition === "ready" ? "In Stock" : "Repair", itStock.id],
    );
    await client.query(
      `INSERT INTO public.asset_stock_receipts
       (asset_id,receipt_type,receipt_date,from_assignment_id,returned_by_user_id,asset_condition,reason,received_by_account_id)
       VALUES ($1,'return',$2,$3,$4,$5,$6,$7)`,
      [assetId, eventDate, current?.id ?? null, returnedBy, returnCondition, returnReason, accountId],
    );
    await logCustodyChange(client, assetId, accountId, "RETURN", before, {
      status: returnCondition === "ready" ? "In Stock" : "Repair",
      location_id: itStock.id, asset_owner_id: null,
      returned_by_user_id: returnedBy, reason: returnReason, date: eventDate,
    });
    await client.query("COMMIT");
    return null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
