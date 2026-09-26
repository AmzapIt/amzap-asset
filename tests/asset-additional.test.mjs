import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAssetAdditional,
  saveAssetAdditional,
} from "../lib/asset-additional.js";

test("blank additional form does not create history records", () => {
  const parsed = parseAssetAdditional({});
  assert.equal(parsed.technicalHasValues, false);
  assert.equal(parsed.securityHasValues, false);
  assert.equal(parsed.document, null);
  assert.equal(parsed.maintenance, null);
});

test("parses technical, security, document URL, and maintenance", () => {
  const parsed = parseAssetAdditional({
    hostname: "NB-001",
    ramGb: "16",
    vlan: "20",
    encryptionEnabled: "true",
    lastSecurityCheck: "2026-09-25",
    documentName: "Invoice",
    documentType: "Purchase",
    documentUrl: "https://drive.google.com/file/d/example/view",
    maintenanceDescription: "Replace battery",
    maintenanceStatus: "Completed",
    maintenanceReportedAt: "2026-09-20",
    maintenanceCompletedAt: "2026-09-21",
    maintenanceCost: "1500.50",
  });

  assert.equal(parsed.technical.vlan, 20);
  assert.equal(parsed.security.encryptionEnabled, true);
  assert.equal(parsed.document.name, "Invoice");
  assert.equal(parsed.maintenance.status, "Completed");
});

test("rejects invalid VLAN, dates, document URLs, and maintenance order", () => {
  assert.throws(() => parseAssetAdditional({ vlan: "4095" }), /VLAN/);
  assert.throws(() => parseAssetAdditional({ ipAddress: "999.1.1.1" }), /IP Address/);
  assert.throws(() => parseAssetAdditional({ macAddress: "not-a-mac" }), /MAC Address/);
  assert.throws(() => parseAssetAdditional({ lastAssetCheck: "2026-02-30" }), /วันที่/);
  assert.throws(
    () => parseAssetAdditional({ documentName: "Invoice", documentUrl: "http://example.com/a.pdf" }),
    /HTTPS/,
  );
  assert.throws(
    () => parseAssetAdditional({
      maintenanceDescription: "Repair",
      maintenanceReportedAt: "2026-09-22",
      maintenanceCompletedAt: "2026-09-21",
    }),
    /Completed Date/,
  );
});

test("save clears empty one-to-one data without creating history", async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rowCount: 1 }; } };

  await saveAssetAdditional(client, "10", parseAssetAdditional({}));

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /DELETE FROM public\.asset_technical/);
  assert.match(calls[1].sql, /DELETE FROM public\.asset_security/);
});
