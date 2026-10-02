import assert from "node:assert/strict";
import test from "node:test";

import { AssignmentError, changeAssignment } from "../lib/assignments.js";

function createPool({ status = "In Stock", locationId = "9", ownerId = null, current = null, latest = null } = {}) {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith("SELECT id,status,location_id,asset_owner_id FROM public.assets")) {
        return { rows: [{ id: "1", status, location_id: locationId, asset_owner_id: ownerId }], rowCount: 1 };
      }
      if (sql.startsWith("SELECT *,assigned_date::text")) {
        return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
      }
      if (sql.startsWith("SELECT (CURRENT_TIMESTAMP")) return { rows: [{ today: "2026-10-01" }], rowCount: 1 };
      if (sql.startsWith("SELECT max(returned_date)")) return { rows: [{ date: latest }], rowCount: 1 };
      if (sql.startsWith("SELECT max(receipt_date)")) return { rows: [{ date: null }], rowCount: 1 };
      if (sql.startsWith("SELECT location.id")) return { rows: [{ id: "9", name: "IT Stock" }], rowCount: 1 };
      if (sql.includes('FROM public."user"')) {
        return { rows: [{ id: "2", department_id: "3" }], rowCount: 1 };
      }
      if (sql.startsWith("SELECT id FROM public.locations")) return { rows: [{ id: "4" }], rowCount: 1 };
      if (sql.startsWith("INSERT INTO public.asset_assignments")) {
        return { rows: [{ id: "10", asset_id: "1", assigned_to: "2" }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE ") || sql.startsWith("INSERT INTO public.asset_stock_receipts") || sql.startsWith("INSERT INTO public.asset_audit_logs")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() { calls.push({ sql: "RELEASE" }); },
  };
  return { calls, connect: async () => client };
}

const assignment = {
  action: "assign",
  date: "2026-10-01",
  assignedTo: "2",
  locationId: "4",
  expectedAssignmentId: null,
};
const returned = {
  action: "return",
  date: "2026-10-01",
  expectedAssignmentId: "10",
  returnReason: "พนักงานลาออก",
  returnCondition: "ready",
};
const current = { id: "10", assigned_to: "2", assigned_date: "2026-09-20" };

test("new issue must start in IT stock and updates employee location", async () => {
  const pool = createPool();
  const result = await changeAssignment("1", assignment, "7", pool);
  assert.equal(result.id, "10");
  assert.ok(pool.calls.some((call) => call.sql.startsWith("UPDATE public.assets SET status='In Use'") && call.values[1] === "4" && call.values[2] === "2"));
  assert.ok(pool.calls.some((call) => call.sql.startsWith("INSERT INTO public.asset_audit_logs") && call.values[1] === "ISSUE"));
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("return records reason, condition and receiving IT account, then moves to stock and clears owner", async () => {
  const pool = createPool({ status: "In Use", locationId: "4", ownerId: "2", current });
  const result = await changeAssignment("1", returned, "7", pool);
  assert.equal(result, null);
  assert.ok(pool.calls.some((call) =>
    call.sql.startsWith("UPDATE public.assets SET status=$2") &&
    call.sql.includes("asset_owner_id=NULL") && call.values[1] === "In Stock" && call.values[2] === "9",
  ));
  assert.ok(pool.calls.some((call) =>
    call.sql.startsWith("INSERT INTO public.asset_stock_receipts") &&
    call.values[5] === "พนักงานลาออก" && call.values[6] === "7",
  ));
  const audit = pool.calls.find((call) => call.sql.startsWith("INSERT INTO public.asset_audit_logs"));
  assert.equal(audit.values[1], "RETURN");
  assert.equal(JSON.parse(audit.values[2]).asset_owner_id, "2");
  assert.equal(JSON.parse(audit.values[3]).asset_owner_id, null);
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("repair completion in IT stock records a result and becomes ready to issue", async () => {
  const pool = createPool({ status: "Repair", locationId: "9" });
  await changeAssignment("1", {
    action: "ready", date: "2026-10-01", expectedAssignmentId: null,
    readyReason: "เปลี่ยนแบตเตอรี่และทดสอบแล้ว",
  }, "7", pool);
  assert.ok(pool.calls.some((call) => call.sql.startsWith("UPDATE public.assets SET status='In Stock',asset_owner_id=NULL")));
  const audit = pool.calls.find((call) => call.sql.startsWith("INSERT INTO public.asset_audit_logs"));
  assert.equal(audit.values[1], "REPAIR_READY");
  assert.equal(JSON.parse(audit.values[3]).repair_result, "เปลี่ยนแบตเตอรี่และทดสอบแล้ว");
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("repair completion rejects missing result or an asset outside repair stock", async () => {
  await assert.rejects(changeAssignment("1", {
    action: "ready", date: "2026-10-01", expectedAssignmentId: null,
    readyReason: " ",
  }, "7", createPool({ status: "Repair" })), AssignmentError);
  const pool = createPool({ status: "In Use", locationId: "4", current });
  await assert.rejects(changeAssignment("1", {
    action: "ready", date: "2026-10-01", expectedAssignmentId: "10",
    readyReason: "เรียบร้อย",
  }, "7", pool), (error) => error instanceof AssignmentError && error.status === 409);
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
});

test("damaged return goes to Repair in IT stock", async () => {
  const pool = createPool({ status: "In Use", locationId: "4", current });
  await changeAssignment("1", { ...returned, returnCondition: "repair" }, "7", pool);
  assert.ok(pool.calls.some((call) =>
    call.sql.startsWith("UPDATE public.assets SET status=$2") &&
    call.values[1] === "Repair",
  ));
});

test("legacy return requires explicitly identified returner", async () => {
  const pool = createPool({ status: "In Use", locationId: "4" });
  await assert.rejects(
    changeAssignment("1", { ...returned, expectedAssignmentId: null }, "7", pool),
    (error) => error instanceof AssignmentError && error.message === "Invalid ID",
  );
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  const valid = createPool({ status: "In Use", locationId: "4", ownerId: "157" });
  await changeAssignment("1", { ...returned, expectedAssignmentId: null, returnedByUserId: "2" }, "7", valid);
  assert.ok(valid.calls.some((call) => call.sql.startsWith("INSERT INTO public.asset_stock_receipts")));
  const audit = valid.calls.find((call) => call.sql.startsWith("INSERT INTO public.asset_audit_logs"));
  assert.equal(JSON.parse(audit.values[2]).asset_owner_id, "157");
  assert.equal(JSON.parse(audit.values[3]).returned_by_user_id, "2");
});

test("direct change is rejected before a transaction", async () => {
  const pool = createPool({ status: "In Use", locationId: "4", current });
  await assert.rejects(
    changeAssignment("1", { ...assignment, action: "change" }, "7", pool),
    (error) => error instanceof AssignmentError && error.message.includes("คลัง IT"),
  );
  assert.equal(pool.calls.length, 0);
});

test("issue outside IT stock is rejected", async () => {
  const pool = createPool({ locationId: "4" });
  await assert.rejects(
    changeAssignment("1", assignment, "7", pool),
    (error) => error instanceof AssignmentError && error.status === 409,
  );
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
});

test("return requires reason and condition", async () => {
  const pool = createPool({ status: "In Use", locationId: "4", current });
  await assert.rejects(changeAssignment("1", { ...returned, returnReason: " " }, "7", pool), AssignmentError);
  await assert.rejects(changeAssignment("1", { ...returned, returnCondition: null }, "7", pool), AssignmentError);
  assert.equal(pool.calls.length, 0);
});

test("stale return and future date are rejected", async () => {
  const stale = createPool({ status: "In Use", locationId: "4", current });
  await assert.rejects(
    changeAssignment("1", { ...returned, expectedAssignmentId: "11" }, "7", stale),
    (error) => error instanceof AssignmentError && error.status === 409,
  );
  const future = createPool();
  await assert.rejects(
    changeAssignment("1", { ...assignment, date: "2026-10-02" }, "7", future),
    (error) => error instanceof AssignmentError && error.message.includes("Future"),
  );
});
