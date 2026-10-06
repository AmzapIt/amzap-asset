import assert from "node:assert/strict";
import test from "node:test";
import {
  closeOffboarding,
  dismissLegacyOffboardingItem,
  getOffboardingOverview,
  OffboardingError,
  startOffboarding,
} from "../lib/offboarding.js";

function fakePool({ existing = null, active = true, pending = 0, licenses = 0, licenseSchema = true, review = true } = {}) {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql: String(sql), values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('to_regclass')) {
        return { rows: [{ licenses: licenseSchema, consumables: licenseSchema }] };
      }
      if (sql.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
      if (sql.includes('FROM public."user" WHERE id=$1 FOR UPDATE')) {
        return { rows: [{ id: "2", is_active: active }], rowCount: 1 };
      }
      if (sql.includes("FROM public.employee_offboardings WHERE user_id=$1 AND closed_at IS NULL")) {
        return { rows: existing ? [{ id: "10" }] : [], rowCount: existing ? 1 : 0 };
      }
      if (sql.startsWith("INSERT INTO public.employee_offboardings")) {
        return { rows: [{ id: "10" }], rowCount: 1 };
      }
      if (sql.includes("FROM public.employee_offboarding_items item")) {
        return { rows: [{ id: "11", requires_review: review, resolution: null }], rowCount: 1 };
      }
      if (sql.startsWith("SELECT received_quantity")) {
        return { rows: [{ received_quantity: 0 }], rowCount: 1 };
      }
      if (sql.includes('FROM public.license_seat_assignments')) {
        return sql.includes('count(*)::int AS count')
          ? { rows: [{ count: licenses }], rowCount: 1 }
          : { rows: Array.from({ length: licenses }, (_, index) => ({ id: String(index + 1), license_name: 'QA License' })) };
      }
      if (sql.includes("count(*)::int AS count")) {
        return { rows: [{ count: pending }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE ") || sql.startsWith("INSERT INTO public.employee_offboarding_items")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  };
  return { calls, connect: async () => client };
}

test("starting resignation deactivates employee and snapshots assets/accessories without stock changes", async () => {
  const pool = fakePool();
  const result = await startOffboarding("2", "7", pool);
  assert.equal(result.id, "10");
  assert.equal(result.alreadyStarted, false);
  assert.ok(pool.calls.some((call) => call.sql.includes('SET is_active=false')));
  assert.equal(pool.calls.filter((call) => call.sql.startsWith("INSERT INTO public.employee_offboarding_items")).length, 2);
  assert.ok(!pool.calls.some((call) => call.sql.includes("UPDATE public.accessory_stock_items")));
  assert.ok(!pool.calls.some((call) => call.sql.includes("UPDATE public.assets")));
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("repeated start is idempotent and does not create another snapshot", async () => {
  const pool = fakePool({ existing: true, active: false });
  const result = await startOffboarding("2", "7", pool);
  assert.equal(result.alreadyStarted, true);
  assert.ok(!pool.calls.some((call) => call.sql.startsWith("INSERT INTO public.employee_offboardings")));
});

test("legacy owner mismatch can be dismissed only with a reason", async () => {
  const pool = fakePool();
  await assert.rejects(
    dismissLegacyOffboardingItem("2", "11", " ", "7", pool),
    OffboardingError,
  );
  assert.equal(pool.calls.length, 0);
  await dismissLegacyOffboardingItem("2", "11", "ตรวจแล้วอยู่กับพนักงานอื่น", "7", pool);
  assert.ok(pool.calls.some((call) => call.sql.includes("resolution='not_held'")));
  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
});

test("confirmed assignment cannot be dismissed as a legacy mismatch", async () => {
  const pool = fakePool({ review: false });
  await assert.rejects(
    dismissLegacyOffboardingItem("2", "11", "ไม่ได้ถือ", "7", pool),
    (error) => error instanceof OffboardingError && error.status === 409,
  );
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
});

test("case cannot be closed until every item is received or reviewed", async () => {
  const blocked = fakePool({ existing: true, pending: 1 });
  await assert.rejects(
    closeOffboarding("2", "7", blocked),
    (error) => error instanceof OffboardingError && error.status === 409,
  );
  assert.ok(blocked.calls.some((call) => call.sql === "ROLLBACK"));
  const clear = fakePool({ existing: true, pending: 0 });
  await closeOffboarding("2", "7", clear);
  assert.ok(clear.calls.some((call) => call.sql.includes("SET closed_at=now()")));
  const licensePending = fakePool({ existing: true, licenses: 1 });
  await assert.rejects(closeOffboarding("2", "7", licensePending),
    (error) => error instanceof OffboardingError && error.status === 409);
  const withoutLicenseTables = fakePool({ existing: true, licenseSchema: false });
  await closeOffboarding("2", "7", withoutLicenseTables);
  assert.ok(!withoutLicenseTables.calls.some((call) => call.sql.includes('FROM public.license_seat_assignments')));
});

test("overview computes pending items and quantity separately", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('to_regclass')) {
        return { rows: [{ licenses: true, consumables: true }] };
      }
      if (sql.includes("FROM public.employee_offboardings")) {
        return { rows: [{ id: "10", user_id: "2", closed_at: null }] };
      }
      if (sql.includes('FROM public.license_seat_assignments')) {
        return { rows: [{ id: '9', license_name: 'Office' }] };
      }
      return { rows: [
        { id: "1", pending_quantity: 1, requires_review: true },
        { id: "2", pending_quantity: 3, requires_review: false },
        { id: "3", pending_quantity: 0, requires_review: false },
      ] };
    },
  };
  const overview = await getOffboardingOverview("2", pool);
  assert.equal(overview.pendingItems, 3);
  assert.equal(overview.pendingQuantity, 5);
  assert.equal(overview.licenseAssignments[0].license_name, 'Office');
  assert.equal(overview.reviewItems, 1);
});

test("overview skips license assignments when migration has not run", async () => {
  const calls = [];
  const overview = await getOffboardingOverview("2", {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('to_regclass')) return { rows: [{ licenses: false, consumables: false }] };
      if (sql.includes('FROM public.employee_offboardings')) {
        return { rows: [{ id: "10", user_id: "2", closed_at: null }] };
      }
      return { rows: [{ id: "1", pending_quantity: 1, requires_review: false }] };
    },
  });
  assert.deepEqual(overview.licenseAssignments, []);
  assert.equal(overview.pendingItems, 1);
  assert.ok(!calls.some((sql) => sql.includes('FROM public.license_seat_assignments')));
});
