import { getDbPool } from "./db.js";

// Domain errors are safe to return to the form; database errors stay on the server.
export class AssignmentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new AssignmentError(message, status); };
function id(value, optional = false) {
  if (optional && (value == null || value === "")) return null;
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) fail("Invalid ID");
  return value;
}
function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000-")
  ) {
    fail("Invalid date");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("Invalid date");
  return value;
}
function notes(value) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > 10000) fail("Notes must be text, at most 10,000 characters");
  return value.trim() || null;
}

export async function changeAssignment(assetId, body, pool = getDbPool()) {
  id(assetId);
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid request");
  const { action } = body;
  if (!["assign", "return", "change"].includes(action)) fail("Invalid action");
  const eventDate = date(body.date);
  const assignedTo = action === "return" ? null : id(body.assignedTo);
  const locationId = action === "return" ? null : id(body.locationId, true);
  const expected = id(body.expectedAssignmentId, true);
  const assignmentNotes = notes(body.assignmentNotes);
  const returnNotes = notes(body.returnNotes);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // All workflows lock the asset first. Concurrent assign/return/change requests
    // serialize here; the existing partial unique index remains the final safeguard.
    const asset = (await client.query("SELECT id,status FROM public.assets WHERE id=$1 FOR UPDATE", [assetId])).rows[0];
    if (!asset) fail("Asset not found", 404);
    const current = (await client.query("SELECT *,assigned_date::text AS assigned_date FROM public.asset_assignments WHERE asset_id=$1 AND returned_date IS NULL FOR UPDATE", [assetId])).rows[0];
    // Compare the assignment the user saw, so a stale Return cannot close a newer assignment.
    if ((current?.id == null ? null : String(current.id)) !== expected) fail("Assignment changed. Refresh and try again.", 409);
    if (action === "assign" && current) fail("Asset is already assigned", 409);
    if (action !== "assign" && !current) fail("Asset has no current assignment", 409);
    if (current && eventDate < current.assigned_date) fail("Return date cannot precede assignment date");
    const today = (await client.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today")).rows[0].today;
    if (eventDate > today) fail("Future assignments/returns are not supported");
    const latest = (await client.query("SELECT max(returned_date)::text AS date FROM public.asset_assignments WHERE asset_id=$1", [assetId])).rows[0].date;
    if (latest && eventDate < latest) fail("Date cannot precede previous return");
    let user;
    if (action !== "return") {
      if (!["In Stock", "Spare", "In Use"].includes(asset.status)) fail("Asset status does not allow assignment", 409);
      if (current && String(current.assigned_to) === assignedTo) fail("Choose a different assignee");
      // History never filters inactive staff, but new assignments require an active employee.
      user = (await client.query('SELECT id,department_id FROM public."user" WHERE id=$1 AND is_active=true FOR SHARE', [assignedTo])).rows[0];
      if (!user) fail("Assignee must be an active employee");
      if (locationId && !(await client.query("SELECT id FROM public.locations WHERE id=$1 AND is_active FOR SHARE", [locationId])).rowCount) fail("Location not found");
    }
    if (current) await client.query("UPDATE public.asset_assignments SET returned_date=$1,return_notes=$2 WHERE id=$3", [eventDate, returnNotes, current.id]);
    let assignment = null;
    if (user) {
      // Department is a historical snapshot of the selected employee, not a guessed form value.
      assignment = (await client.query("INSERT INTO public.asset_assignments(asset_id,assigned_to,department_id,location_id,assigned_date,assignment_notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [assetId, assignedTo, user.department_id, locationId, eventDate, assignmentNotes])).rows[0];
      await client.query("UPDATE public.assets SET status='In Use',location_id=$2 WHERE id=$1", [assetId, locationId]);
    } else {
      // Preserve Repair/Lost/etc if someone changed the asset state while it was assigned.
      await client.query("UPDATE public.assets SET status=CASE WHEN status='In Use' THEN 'In Stock' ELSE status END WHERE id=$1", [assetId]);
    }
    // Never change asset_owner_id or identity fields: ownership and custody are separate concepts.
    await client.query("COMMIT");
    return assignment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
