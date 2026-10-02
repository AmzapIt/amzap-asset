import assert from "node:assert/strict";
import test from "node:test";
import {
  AssetMovementError,
  moveAsset,
} from "../lib/asset-movements.js";

function createPool({
  asset = {
    id: "10",
    status: "Spare",
    location_id: "1",
    owning_department_id: "2",
    asset_owner_id: "3",
  },
  today = "2026-09-26",
  latestMovementDate = null,
  activeTargets = true,
  currentAssignedTo = null,
} = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, values = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, values });

      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(normalized)) {
        return { rows: [], rowCount: null };
      }
      if (normalized.includes("FROM public.assets") && normalized.includes("FOR UPDATE")) {
        return { rows: asset ? [asset] : [], rowCount: asset ? 1 : 0 };
      }
      if (normalized.includes("AS today")) {
        return { rows: [{ today }], rowCount: 1 };
      }
      if (normalized.includes("max(movement_date)")) {
        return {
          rows: [{ movement_date: latestMovementDate }],
          rowCount: 1,
        };
      }
      if (normalized.startsWith("SELECT location.id")) {
        return { rows: [{ id: "9", name: "IT Stock" }], rowCount: 1 };
      }
      if (normalized.startsWith("SELECT 1 FROM public.asset_assignments")) {
        return { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith("SELECT assigned_to FROM public.asset_assignments")) {
        return currentAssignedTo
          ? { rows: [{ assigned_to: currentAssignedTo }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith("SELECT id FROM public.")) {
        return activeTargets
          ? { rows: [{ id: values[0] }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith("UPDATE public.assets")) {
        return {
          rows: [
            {
              id: values[0],
              location_id: values[1],
              owning_department_id: values[2],
              asset_owner_id: values[3],
            },
          ],
          rowCount: 1,
        };
      }
      if (normalized.startsWith("INSERT INTO public.asset_movements")) {
        return {
          rows: [{ id: "99", asset_id: values[0], movement_date: values[1] }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${normalized}`);
    },
    release() {
      this.released = true;
    },
  };

  return {
    calls,
    client,
    pool: { async connect() { return client; } },
  };
}

function movement(overrides = {}) {
  return {
    movementDate: "2026-09-26",
    reason: "ย้ายไปโรงงาน 2",
    notes: "ตรวจรับเรียบร้อย",
    toLocationId: "2",
    toDepartmentId: "4",
    toOwnerId: "5",
    expectedLocationId: "1",
    expectedDepartmentId: "2",
    expectedOwnerId: "3",
    ...overrides,
  };
}

test("movement updates the asset and stores before/after history", async () => {
  const fake = createPool();
  const result = await moveAsset("10", movement(), "7", fake.pool);

  assert.equal(result.asset.location_id, "2");
  assert.equal(result.asset.owning_department_id, "4");
  assert.equal(result.asset.asset_owner_id, "5");
  assert.equal(result.movement.id, "99");
  assert.ok(fake.calls.some((call) => call.sql === "COMMIT"));
  assert.ok(!fake.calls.some((call) => call.sql === "ROLLBACK"));

  const insert = fake.calls.find((call) =>
    call.sql.startsWith("INSERT INTO public.asset_movements"),
  );
  assert.deepEqual(insert.values, [
    "10", "2026-09-26", "1", "2", "2", "4", "3", "5",
    "ย้ายไปโรงงาน 2", "ตรวจรับเรียบร้อย", "7",
  ]);
  assert.equal(fake.client.released, true);
});

test("stale movement data is rejected and rolled back", async () => {
  const fake = createPool();

  await assert.rejects(
    moveAsset(
      "10",
      movement({ expectedLocationId: "9" }),
      "7",
      fake.pool,
    ),
    (error) =>
      error instanceof AssetMovementError &&
      error.status === 409 &&
      /Refresh/.test(error.message),
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(!fake.calls.some((call) => call.sql.startsWith("UPDATE public.assets")));
});

test("movement requires at least one changed value", async () => {
  const fake = createPool();

  await assert.rejects(
    moveAsset(
      "10",
      movement({
        toLocationId: "1",
        toDepartmentId: "2",
        toOwnerId: "3",
      }),
      "7",
      fake.pool,
    ),
    /Choose at least one/,
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
});

test("movement rejects inactive new master data", async () => {
  const fake = createPool({ activeTargets: false });

  await assert.rejects(
    moveAsset("10", movement(), "7", fake.pool),
    /must be active/,
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
});

test("an In Use asset cannot be moved into IT stock without a return receipt", async () => {
  const fake = createPool({ asset: {
    id: "10", status: "In Use", location_id: "1",
    owning_department_id: "2", asset_owner_id: "3",
  } });
  await assert.rejects(
    moveAsset("10", movement({ toLocationId: "9" }), "7", fake.pool),
    (error) => error instanceof AssetMovementError && error.status === 409,
  );
  assert.ok(!fake.calls.some((call) => call.sql.startsWith("UPDATE public.assets")));
});

test("In Stock cannot leave IT stock without an assignment", async () => {
  const fake = createPool({ asset: {
    id: "10", status: "In Stock", location_id: "9",
    owning_department_id: "2", asset_owner_id: "3",
  } });
  await assert.rejects(
    moveAsset("10", movement({ expectedLocationId: "9" }), "7", fake.pool),
    (error) => error instanceof AssetMovementError && error.status === 409,
  );
  assert.ok(!fake.calls.some((call) => call.sql.startsWith("UPDATE public.assets")));
});

test("stock cannot receive an owner through Movement", async () => {
  const fake = createPool({ asset: {
    id: "10", status: "In Stock", location_id: "9",
    owning_department_id: "2", asset_owner_id: null,
  } });
  await assert.rejects(
    moveAsset("10", movement({
      toLocationId: "9", toDepartmentId: "2", toOwnerId: "5",
      expectedLocationId: "9", expectedOwnerId: null,
    }), "7", fake.pool),
    (error) => error instanceof AssetMovementError && error.status === 409,
  );
  assert.ok(!fake.calls.some((call) => call.sql.startsWith("UPDATE public.assets")));
});

test("Movement cannot contradict an open Assignment owner", async () => {
  const fake = createPool({
    asset: { id: "10", status: "In Use", location_id: "1", owning_department_id: "2", asset_owner_id: "3" },
    currentAssignedTo: "3",
  });
  await assert.rejects(
    moveAsset("10", movement({ toLocationId: "1", toDepartmentId: "2" }), "7", fake.pool),
    (error) => error instanceof AssetMovementError && error.status === 409,
  );
  assert.ok(!fake.calls.some((call) => call.sql.startsWith("UPDATE public.assets")));
});
