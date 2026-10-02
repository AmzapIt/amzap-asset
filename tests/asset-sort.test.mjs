import assert from "node:assert/strict";
import test from "node:test";
import { compareNaturalText } from "../lib/asset-sort.js";

test("Asset filter options have a deterministic Thai/English order", () => {
  const locations = ["คลัง IT", "Amzap โรงงาน 10", "Amzap โรงงาน 2", "Amzap โรงงาน 1"];
  assert.deepEqual(locations.sort(compareNaturalText), [
    "Amzap โรงงาน 1",
    "Amzap โรงงาน 2",
    "Amzap โรงงาน 10",
    "คลัง IT",
  ]);
});

test("Asset codes retain natural numeric order without localeCompare", () => {
  const codes = ["F1-NB-41", "F1-NB-9", "F1-NB-10"];
  assert.deepEqual(codes.sort(compareNaturalText), [
    "F1-NB-9",
    "F1-NB-10",
    "F1-NB-41",
  ]);
});
