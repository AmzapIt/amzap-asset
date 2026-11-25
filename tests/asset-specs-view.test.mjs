import assert from "node:assert/strict";
import test from "node:test";
import { specsSections } from "../lib/asset-specs-view.js";

test("shows only filled specs and never the Office account", () => {
  const sections = specsSections({
    hostname: "PC-1", cpu: null, ram_gb: "16.00", storage_gb: null,
    extra_specs: { screenSize: "15.6\"", resolution: null, officeProduct: "Microsoft 365", officeAccount: "user@example.com" },
  });
  assert.deepEqual(sections, [
    { title: "Technical Information", rows: [["Hostname", "PC-1"], ["RAM", "16 GB"], ["จอ", "15.6\""]] },
    { title: "Software", rows: [["Office", "Microsoft 365"]] },
  ]);
  assert.doesNotMatch(JSON.stringify(sections), /user@example/);
});

test("returns no sections when there is no data", () => {
  assert.deepEqual(specsSections(undefined), []);
  assert.deepEqual(specsSections({ extra_specs: null }), []);
});
