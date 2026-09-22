import assert from "node:assert/strict";
import test from "node:test";

import { AssignmentError, changeAssignment } from "../lib/assignments.js";

function createPool({ status = "In Stock", current = null, latest = null } = {}) {
  const calls = [];

  const client = {
    async query(sql, values) {
      calls.push({ sql, values });

      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }

      if (sql.startsWith("SELECT id,status FROM public.assets")) {
        return { rows: [{ id: "1", status }], rowCount: 1 };
      }

      if (sql.startsWith("SELECT *,assigned_date::text")) {
        return {
          rows: current ? [current] : [],
          rowCount: current ? 1 : 0,
        };
      }

      if (sql.startsWith("SELECT (CURRENT_TIMESTAMP")) {
        return { rows: [{ today: "2026-09-22" }], rowCount: 1 };
      }

      if (sql.startsWith("SELECT max(returned_date)")) {
        return { rows: [{ date: latest }], rowCount: 1 };
      }

      if (sql.includes('FROM public."user"')) {
        return {
          rows: [{ id: "2", department_id: "3" }],
          rowCount: 1,
        };
      }

      if (sql.startsWith("SELECT id FROM public.locations")) {
        return { rows: [{ id: "4" }], rowCount: 1 };
      }

      if (sql.startsWith("INSERT INTO public.asset_assignments")) {
        return {
          rows: [{ id: "10", asset_id: "1", assigned_to: "2" }],
          rowCount: 1,
        };
      }

      if (
        sql.startsWith("UPDATE public.asset_assignments") ||
        sql.startsWith("UPDATE public.assets")
      ) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },

    release() {
      calls.push({ sql: "RELEASE" });
    },
  };

  return {
    calls,
    connect: async () => client,
  };
}

test("assign creates an assignment and commits", async () => {
  const pool = createPool();

  const assignment = await changeAssignment(
    "1",
    {
      action: "assign",
      date: "2026-09-22",
      assignedTo: "2",
      locationId: "4",
      expectedAssignmentId: null,
      assignmentNotes: "Issued for work",
    },
    pool,
  );

  assert.equal(assignment.id, "10");
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
  assert.ok(
    pool.calls.some((call) =>
      call.sql.startsWith("UPDATE public.assets SET status='In Use'"),
    ),
  );
});

test("return closes the current assignment and returns the asset to stock", async () => {
  const pool = createPool({
    status: "In Use",
    current: {
      id: "10",
      assigned_to: "2",
      assigned_date: "2026-09-20",
    },
  });

  const assignment = await changeAssignment(
    "1",
    {
      action: "return",
      date: "2026-09-22",
      expectedAssignmentId: "10",
      returnNotes: "Returned in good condition",
    },
    pool,
  );

  assert.equal(assignment, null);
  assert.ok(
    pool.calls.some((call) =>
      call.sql.startsWith("UPDATE public.asset_assignments"),
    ),
  );
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("a stale assignment request rolls back", async () => {
  const pool = createPool({
    status: "In Use",
    current: {
      id: "11",
      assigned_to: "2",
      assigned_date: "2026-09-20",
    },
  });

  await assert.rejects(
    changeAssignment(
      "1",
      {
        action: "return",
        date: "2026-09-22",
        expectedAssignmentId: "10",
      },
      pool,
    ),
    (error) =>
      error instanceof AssignmentError &&
      error.status === 409 &&
      error.message.includes("Refresh"),
  );

  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(!pool.calls.some((call) => call.sql === "COMMIT"));
});

test("a future assignment date rolls back", async () => {
  const pool = createPool();

  await assert.rejects(
    changeAssignment(
      "1",
      {
        action: "assign",
        date: "2026-09-23",
        assignedTo: "2",
        expectedAssignmentId: null,
      },
      pool,
    ),
    (error) =>
      error instanceof AssignmentError && error.message.includes("Future"),
  );

  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(!pool.calls.some((call) => call.sql === "COMMIT"));
});
