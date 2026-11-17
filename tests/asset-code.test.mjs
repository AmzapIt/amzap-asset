import assert from "node:assert/strict";
import test from "node:test";
import {
  assetCodeGroup,
  assetCodeSeriesPattern,
  assetCodeYear,
  buildAssetCode,
  buildAssetCodePreview,
  formatAssetCodeNumber,
  parseAssetCodeNumber,
  parseRegistrationSiteId,
} from "../lib/asset-code.js";

test("builds the preview from company group, year and asset type", () => {
  assert.equal(buildAssetCodePreview("F1", "NB", "", "26"), "AMZAP26-NB-XXX");
  assert.equal(buildAssetCodePreview("f2", "mon", "", "26"), "AMZAP26-MON-XXX");
  assert.equal(buildAssetCodePreview("m1", "nb", "", "26"), "MEMO26-NB-XXX");
  assert.equal(buildAssetCodePreview("F1", "NB", "007", "27"), "AMZAP27-NB-007");
});

test("validates the manual three-digit suffix and composes the full code", () => {
  assert.equal(parseAssetCodeNumber("001"), "001");
  assert.equal(buildAssetCode("f1", "nb", "025", "26"), "AMZAP26-NB-025");
  assert.equal(buildAssetCode("F2", "NB", "025", "26"), "AMZAP26-NB-025");
  assert.equal(buildAssetCode("m1", "nb", "026", "26"), "MEMO26-NB-026");

  for (const value of ["", "1", "01", "1000", "12A", 1]) {
    assert.throws(() => parseAssetCodeNumber(value));
  }
  assert.throws(() => buildAssetCode("M2", "NB", "001", "26"));
});

test("maps registration sites to company groups", () => {
  assert.equal(assetCodeGroup("F1"), "AMZAP");
  assert.equal(assetCodeGroup("f12"), "AMZAP");
  assert.equal(assetCodeGroup("M1"), "MEMO");
  assert.equal(assetCodeGroup("M2"), null);
  assert.equal(assetCodeGroup(""), null);
});

test("uses the Bangkok calendar year for the code year", () => {
  // 2026-12-31 18:00 UTC is already 2027-01-01 in Bangkok
  assert.equal(assetCodeYear(new Date("2026-12-31T18:00:00Z")), "27");
  assert.equal(assetCodeYear(new Date("2026-06-01T00:00:00Z")), "26");
});

test("running-number series includes legacy codes only in 2026", () => {
  const amzap26 = new RegExp(assetCodeSeriesPattern("F2", "NB", "26"));
  assert.ok(amzap26.test("AMZAP26-NB-054"));
  assert.ok(amzap26.test("F1-NB-054"));
  assert.ok(!amzap26.test("M1-NB-001"));
  assert.ok(!amzap26.test("MEMO26-NB-001"));
  assert.ok(!amzap26.test("AMZAP27-NB-001"));

  const memo26 = new RegExp(assetCodeSeriesPattern("M1", "NB", "26"));
  assert.ok(memo26.test("M1-NB-001") && memo26.test("MEMO26-NB-001"));
  assert.ok(!memo26.test("F1-NB-001"));

  const amzap27 = new RegExp(assetCodeSeriesPattern("F1", "NB", "27"));
  assert.ok(amzap27.test("AMZAP27-NB-001"));
  assert.ok(!amzap27.test("F1-NB-001") && !amzap27.test("AMZAP26-NB-001"));
});

test("formats the shared latest running number without a site prefix", () => {
  assert.equal(formatAssetCodeNumber(40), "040");
  assert.equal(formatAssetCodeNumber("7"), "007");
  assert.equal(formatAssetCodeNumber(null), null);

  for (const value of [-1, 1000, "invalid"]) {
    assert.throws(() => formatAssetCodeNumber(value));
  }
});

test("does not display a complete preview when either identity part is invalid", () => {
  assert.equal(buildAssetCodePreview("", "NB"), "---");
  assert.equal(buildAssetCodePreview("F1", "", "", "26"), "AMZAP26----");
  assert.equal(buildAssetCodePreview("Factory1", "NB"), "---");
  assert.equal(buildAssetCodePreview("M2", "NB"), "---");
});

test("keeps a valid bigint registration-site ID as a string", () => {
  assert.equal(parseRegistrationSiteId("2"), "2");
  assert.equal(
    parseRegistrationSiteId("9223372036854775807"),
    "9223372036854775807",
  );
});

test("rejects missing or malformed registration-site IDs", () => {
  for (const value of ["", "0", "-1", "1.5", 1, "9223372036854775808"]) {
    assert.throws(() => parseRegistrationSiteId(value));
  }
});
