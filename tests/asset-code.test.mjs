import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssetCode,
  buildAssetCodePreview,
  parseAssetCodeNumber,
  parseRegistrationSiteId,
} from "../lib/asset-code.js";

test("builds the V2 preview from registration site and asset type", () => {
  assert.equal(buildAssetCodePreview("F1", "NB"), "F1-NB-XXX");
  assert.equal(buildAssetCodePreview("f2", "mon"), "F2-MON-XXX");
  assert.equal(buildAssetCodePreview("F1", "NB", "007"), "F1-NB-007");
});

test("validates the manual three-digit suffix and composes the full code", () => {
  assert.equal(parseAssetCodeNumber("001"), "001");
  assert.equal(buildAssetCode("f1", "nb", "025"), "F1-NB-025");

  for (const value of ["", "1", "01", "1000", "12A", 1]) {
    assert.throws(() => parseAssetCodeNumber(value));
  }
});

test("does not display a complete preview when either identity part is invalid", () => {
  assert.equal(buildAssetCodePreview("", "NB"), "---");
  assert.equal(buildAssetCodePreview("F1", ""), "F1----");
  assert.equal(buildAssetCodePreview("Factory1", "NB"), "---");
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
