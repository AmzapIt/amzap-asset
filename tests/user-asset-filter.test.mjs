import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesUserAssetFilter,
  summarizeUserAssets,
} from "../lib/user-asset-filter.js";

const users = [
  { id: 1, is_active: true, current_asset_count: 2 },
  { id: 2, is_active: true, current_asset_count: 0 },
  { id: 3, is_active: false, current_asset_count: 1 },
  { id: 4, is_active: false, current_asset_count: 0 },
];

test("Asset summary counts only active employees", () => {
  assert.deepEqual(summarizeUserAssets(users), {
    assigned: 1,
    unassigned: 1,
  });
});

test("Asset filters exclude inactive employees but all keeps them visible", () => {
  assert.deepEqual(
    users.filter((user) => matchesUserAssetFilter(user, "assigned")).map((user) => user.id),
    [1],
  );
  assert.deepEqual(
    users.filter((user) => matchesUserAssetFilter(user, "unassigned")).map((user) => user.id),
    [2],
  );
  assert.equal(users.filter((user) => matchesUserAssetFilter(user, "all")).length, 4);
});
