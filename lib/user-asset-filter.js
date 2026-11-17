export function getCurrentAssetCount(user) {
  const count = Number(user.current_asset_count);
  return Number.isFinite(count) ? count : 0;
}

export function summarizeUserAssets(users) {
  const activeUsers = users.filter((user) => user.is_active === true);
  const assigned = activeUsers.filter(
    (user) => getCurrentAssetCount(user) > 0,
  ).length;

  return {
    assigned,
    unassigned: activeUsers.length - assigned,
  };
}

export function matchesUserAssetFilter(user, filter) {
  if (filter !== "assigned" && filter !== "unassigned") return true;
  if (user.is_active !== true) return false;

  const hasAssets = getCurrentAssetCount(user) > 0;
  return filter === "assigned" ? hasAssets : !hasAssets;
}
