import assert from "node:assert/strict";
import test from "node:test";
import { ASSET_ISSUES, assetListHref, parseAssetLinkFilters, summarizeAssets } from "../lib/dashboard-summary.js";

const TODAY = "2026-11-25";
const asset = (extra) => ({
  status: "In Use", asset_type: "Notebook", asset_type_prefix: "NB", location: "F1", owner_id: "1",
  serial_number: "S1", warranty_end: null, maintenance_open: false, specs_imported_date: null, ...extra,
});
const issue = (summary, key) => summary.issues.find((item) => item.key === key).count;

test("counts statuses, types, stock and specs", () => {
  const summary = summarizeAssets([
    asset({ specs_imported_date: "25/11/2026" }),
    asset({ status: "In Stock", owner_id: null }),
    asset({ status: "Retired", owner_id: null }),
    asset({ asset_type: "Monitor", asset_type_prefix: "MON", status: "Spare" }),
  ], TODAY);
  assert.equal(summary.total, 4);
  assert.deepEqual(Object.fromEntries(summary.statuses.map((s) => [s.status, s.count])), { "In Use": 1, "In Stock": 1, Repair: 0, Retired: 1, Spare: 1 });
  assert.deepEqual(summary.types[0], { name: "Notebook", total: 3, statuses: { "In Use": 1, "In Stock": 1, other: 1 } });
  assert.deepEqual(summary.stock, [{ name: "Notebook", count: 1 }]);
  assert.deepEqual(summary.specs, { total: 2, imported: 1 });
});

test("issues skip retired assets and stock does not need an owner", () => {
  const summary = summarizeAssets([
    asset({ owner_id: null }), asset({ status: "In Stock", owner_id: null }),
    asset({ serial_number: " " }), asset({ status: "Retired", serial_number: null, location: null, owner_id: null }),
    asset({ location: null }), asset({ maintenance_open: true }),
  ], TODAY);
  for (const key of ["noOwner", "noSerial", "noLocation", "repair"]) assert.equal(issue(summary, key), 1, key);
});

test("warranty window is today through 30 days", () => {
  const ends = ["2026-11-24", "2026-11-25", "2026-12-25", "2026-12-26"];
  assert.deepEqual(ends.map((warranty_end) => ASSET_ISSUES.warranty.match(asset({ warranty_end }), TODAY)), [false, true, true, false]);
});

test("locations beyond the limit are merged", () => {
  const rows = summarizeAssets(Array.from({ length: 10 }, (_, i) => asset({ location: `L${i}` })), TODAY).locations;
  assert.equal(rows.length, 9);
  assert.deepEqual(rows[8], { name: null, total: 2, statuses: { "In Use": 2 } });
});

test("link filters round-trip and unknown values are dropped", () => {
  const href = assetListHref({ type: "Mobile Device", status: "In Stock", location: "" });
  assert.equal(href, "/assets?type=Mobile+Device&status=In+Stock");
  assert.deepEqual(parseAssetLinkFilters(Object.fromEntries(new URL(href, "http://x").searchParams)), { type: "Mobile Device", status: "In Stock" });
  assert.equal(parseAssetLinkFilters({ issue: "toString", other: "x", type: ["a"] }), null);
  assert.deepEqual(parseAssetLinkFilters({ issue: "noSpecs" }), { issue: "noSpecs" });
});
