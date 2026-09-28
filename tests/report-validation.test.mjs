import assert from "node:assert/strict";
import test from "node:test";

import { findHandoverConflict } from "../lib/report-validation.js";

test("return form accepts only assets currently held by the recipient", () => {
  const rows = [
    { asset_code: "F1-NB-001", current_holder_id: "10" },
    { asset_code: "F1-MON-001", current_holder_id: "10" },
  ];

  assert.equal(findHandoverConflict(rows, "10", "คืนอุปกรณ์"), null);
  assert.equal(
    findHandoverConflict(rows, "20", "คืนอุปกรณ์")?.asset_code,
    "F1-NB-001",
  );
});

test("handover form allows unassigned assets but rejects another holder", () => {
  const allowedRows = [
    { asset_code: "F1-NB-002", current_holder_id: null },
    { asset_code: "F1-MON-002", current_holder_id: "10" },
  ];
  const blockedRows = [
    ...allowedRows,
    { asset_code: "F1-PHN-001", current_holder_id: "20" },
  ];

  assert.equal(
    findHandoverConflict(allowedRows, "10", "เปลี่ยนอุปกรณ์"),
    null,
  );
  assert.equal(
    findHandoverConflict(blockedRows, "10", "เปลี่ยนอุปกรณ์")?.asset_code,
    "F1-PHN-001",
  );
});
