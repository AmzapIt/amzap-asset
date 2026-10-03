import assert from "node:assert/strict";
import test from "node:test";
import { getCustodyReport, getOffboardingPendingReport } from "../lib/report-center.js";
import { reportCsv } from "../lib/report-csv.js";

test("custody report returns database history without rewriting rows", async () => {
  const rows = [{ id: "assignment:1", period_status: "current" }];
  let sql;
  const result = await getCustodyReport({
    query: async (statement) => {
      sql = statement;
      return { rows };
    },
  });
  assert.equal(result, rows);
  assert.match(sql, /asset_assignments/);
  assert.match(sql, /asset_stock_receipts/);
  assert.match(sql, /changed_by_account_id/);
  assert.match(sql, /period_status/);
  assert.match(sql, /Legacy Owner/);
});

test("offboarding report contains only outstanding items and formats names", async () => {
  const row = {
    item_id: "9", item_type: "accessory", pending_quantity: 2,
    full_name: "Test User", nickname: "T", accessory_type: "Mouse",
    accessory_brand: "Example", accessory_model: "M1",
  };
  let sql;
  const result = await getOffboardingPendingReport({
    query: async (statement) => {
      sql = statement;
      return { rows: [row] };
    },
  });
  assert.equal(result[0].employee_name, "Test User (T)");
  assert.equal(result[0].item_name, "Mouse · Example · M1");
  assert.match(sql, /item\.pending_quantity>0/);
  assert.match(sql, /offboarding\.closed_at IS NULL/);
});

test("report CSV escapes quotes and neutralizes spreadsheet formulas", () => {
  const csv = reportCsv([
    { name: '=HYPERLINK("https://example.com")', reason: "line 1\nline 2" },
    { name: "normal", reason: "+SUM(1,2)" },
  ], [{ key: "name", label: "ชื่อ" }, { key: "reason", label: "เหตุผล" }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"https://example.com\"\")\""));
  assert.ok(csv.includes("\"line 1\nline 2\""));
  assert.ok(csv.includes("\"'+SUM(1,2)\""));
});
