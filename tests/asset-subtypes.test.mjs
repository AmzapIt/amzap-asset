import assert from "node:assert/strict";
import test from "node:test";
import { assetChanges } from "../lib/asset-history.js";
import {
  parseSubtypeId,
  parseSubtypeInput,
  saveAssetSubtype,
  validateAssetSubtype,
} from "../lib/asset-subtypes.js";

function fakeDb(rows) {
  const calls = [];
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: typeof rows === "function" ? rows(sql, values) : rows };
    },
  };
}

test("subtype id is optional but must be a positive id", () => {
  assert.equal(parseSubtypeId(""), null);
  assert.equal(parseSubtypeId(null), null);
  assert.equal(parseSubtypeId(undefined), null);
  assert.equal(parseSubtypeId("12"), "12");
  for (const value of ["0", "-1", "1.5", "abc", 12, "99999999999999999999"]) {
    assert.throws(() => parseSubtypeId(value), /ประเภทย่อยไม่ถูกต้อง/, String(value));
  }
});

test("subtype must belong to the asset type and be active, except the asset's current value", async () => {
  assert.equal(await validateAssetSubtype(fakeDb([]), null, "16"), null);

  const active = fakeDb([{ id: "3", asset_type_id: "16", is_active: true }]);
  assert.equal(await validateAssetSubtype(active, "3", "16"), "3");
  await assert.rejects(validateAssetSubtype(active, "3", "1"), /ไม่ตรงกับ Asset Type/);
  await assert.rejects(validateAssetSubtype(fakeDb([]), "99", "16"), /ไม่ตรงกับ Asset Type/);

  const inactive = fakeDb([{ id: "4", asset_type_id: "16", is_active: false }]);
  await assert.rejects(validateAssetSubtype(inactive, "4", "16"), /ถูกปิดใช้งาน/);
  assert.equal(await validateAssetSubtype(inactive, "4", "16", "4"), "4");
});

test("parses settings input: name is trimmed, type is required only when adding", () => {
  assert.deepEqual(
    parseSubtypeInput({ assetTypeId: "16", name: "  IP   Camera ", isActive: true, sortOrder: 2 }),
    { id: null, assetTypeId: "16", name: "IP Camera", isActive: true, sortOrder: 2 },
  );
  // แก้ไข: ไม่รับ assetTypeId (ย้ายประเภทไม่ได้)
  assert.deepEqual(
    parseSubtypeInput({ id: "5", assetTypeId: "1", name: "NVR", isActive: false }),
    { id: "5", assetTypeId: null, name: "NVR", isActive: false, sortOrder: 0 },
  );
  assert.throws(() => parseSubtypeInput({ name: "X", isActive: true }), /เลือก Asset Type/);
  assert.throws(() => parseSubtypeInput({ assetTypeId: "1", name: "  ", isActive: true }), /กรอกชื่อ/);
  assert.throws(() => parseSubtypeInput({ assetTypeId: "1", name: "x".repeat(101), isActive: true }), /100/);
  assert.throws(() => parseSubtypeInput({ assetTypeId: "1", name: "X", isActive: "yes" }), /สถานะ/);
  assert.throws(() => parseSubtypeInput({ assetTypeId: "1", name: "X", isActive: true, sortOrder: 1000 }), /0-999/);
  assert.throws(() => parseSubtypeInput([]), /ไม่ถูกต้อง/);
});

test("adding a subtype checks the asset type and reports duplicate names", async () => {
  const db = fakeDb((sql) => (sql.includes("FROM public.asset_types") ? [{ is_active: true }] : [{ id: "30" }]));
  assert.equal(await saveAssetSubtype(db, { id: null, assetTypeId: "16", name: "Router", isActive: true, sortOrder: 1 }), "30");
  assert.match(db.calls.at(-1).sql, /INSERT INTO public\.asset_subtypes/);

  await assert.rejects(
    saveAssetSubtype(fakeDb([{ is_active: false }]), { id: null, assetTypeId: "7", name: "X", isActive: true, sortOrder: 0 }),
    /ปิดใช้งาน/,
  );

  const duplicate = {
    query: async (sql) => {
      if (sql.includes("FROM public.asset_types")) return { rows: [{ is_active: true }] };
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    },
  };
  await assert.rejects(
    saveAssetSubtype(duplicate, { id: null, assetTypeId: "16", name: "router", isActive: true, sortOrder: 0 }),
    (error) => error.status === 409 && /มีอยู่แล้ว/.test(error.message),
  );
});

test("editing a subtype only updates name, order and status", async () => {
  const db = fakeDb([{ id: "5" }]);
  await saveAssetSubtype(db, { id: "5", assetTypeId: null, name: "NVR", isActive: false, sortOrder: 3 });
  assert.match(db.calls[0].sql, /UPDATE public\.asset_subtypes SET name=\$2, is_active=\$3, sort_order=\$4/);
  assert.doesNotMatch(db.calls[0].sql, /asset_type_id/);
  await assert.rejects(saveAssetSubtype(fakeDb([]), { id: "9", name: "X", isActive: true, sortOrder: 0 }), /ไม่พบ/);
});

test("history shows subtype and asset type changes by name", () => {
  assert.deepEqual(
    assetChanges({ subtype: null, status: "In Use" }, { subtype: "Firewall", status: "In Use" }),
    [{ field: "ประเภทย่อย", before: null, after: "Firewall" }],
  );
  assert.deepEqual(
    assetChanges(
      { asset_code: "AMZAP26-LIC-001", asset_type: "License" },
      { asset_code: "AMZAP26-OTH-001", asset_type: "Other", subtype: "License" },
    ).map(({ field }) => field),
    ["รหัส Asset", "ประเภท", "ประเภทย่อย"],
  );
});
