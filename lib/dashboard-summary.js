// สรุป Dashboard จากแถวชุดเดียวกับหน้ารายการ Asset (getReportAssets)
// ตัวเลขบน Dashboard จึงตรงกับรายการที่กดไปดูเสมอ · ใช้ได้ทั้ง browser และ server
import { SPECS_TYPE_PREFIXES } from "./asset-specs-view.js";

const INACTIVE = new Set(["Retired", "Disposed", "Lost"]);
const isActive = (asset) => !INACTIVE.has(asset.status);
const blank = (value) => !String(value ?? "").trim();

export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// เรื่องที่ต้องจัดการ: ไม่นับ Retired / Disposed / Lost และ Owner นับเฉพาะเครื่องที่ใช้งานอยู่
export const ASSET_ISSUES = {
  noOwner: { label: "ใช้งานอยู่แต่ไม่มี Owner", done: "เครื่องที่ใช้งานมี Owner ครบ", match: (a) => a.status === "In Use" && !a.owner_id },
  noSerial: { label: "ไม่มี Serial Number", done: "มี Serial ครบ", match: (a) => isActive(a) && blank(a.serial_number) },
  noLocation: { label: "ไม่มีสถานที่", done: "มีสถานที่ครบ", match: (a) => isActive(a) && blank(a.location) },
  warranty: {
    label: "ประกันหมดใน 30 วัน", done: "ไม่มีประกันใกล้หมด",
    match: (a, today) => isActive(a) && Boolean(a.warranty_end) && a.warranty_end >= today && a.warranty_end <= addDays(today, 30),
  },
  repair: { label: "งานซ่อมค้าง", done: "ไม่มีงานซ่อมค้าง", match: (a) => Boolean(a.maintenance_open) },
  noSpecs: { label: "ยังไม่นำเข้าสเปกเครื่อง", done: "นำเข้าสเปกครบ", match: (a) => canHaveSpecs(a) && !a.specs_imported_date },
};

function canHaveSpecs(asset) {
  return isActive(asset) && SPECS_TYPE_PREFIXES.includes(asset.asset_type_prefix);
}

// กลุ่มสีในกราฟ: สถานะอื่นทั้งหมด (Spare, Retired, ...) รวมเป็น "อื่นๆ"
export const STATUS_GROUPS = [
  { key: "In Use", label: "ใช้งาน", color: "#2a78d6" },
  { key: "In Stock", label: "ในคลัง", color: "#1baf7a" },
  { key: "Repair", label: "ซ่อม", color: "#eb6834" },
  { key: "other", label: "อื่นๆ", color: "#4a3aa7" },
];
const MAIN_STATUSES = new Set(["In Use", "In Stock", "Repair"]);

function groupBy(assets, key, limit = Infinity) {
  const map = new Map();
  for (const asset of assets) {
    const name = asset[key] || "";
    const row = map.get(name) || { name, total: 0, statuses: {} };
    const status = MAIN_STATUSES.has(asset.status) ? asset.status : "other";
    row.total += 1;
    row.statuses[status] = (row.statuses[status] || 0) + 1;
    map.set(name, row);
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  if (rows.length <= limit) return rows;
  const rest = rows.slice(limit);
  const merged = { name: null, total: 0, statuses: {} }; // null = อื่นๆ รวมกัน ไม่มีลิงก์
  for (const row of rest) {
    merged.total += row.total;
    for (const [status, count] of Object.entries(row.statuses)) merged.statuses[status] = (merged.statuses[status] || 0) + count;
  }
  return [...rows.slice(0, limit), merged];
}

export function summarizeAssets(assets, today = bangkokToday()) {
  const statusCounts = new Map([["In Use", 0], ["In Stock", 0], ["Repair", 0]]);
  for (const asset of assets) statusCounts.set(asset.status, (statusCounts.get(asset.status) || 0) + 1);

  const stock = new Map();
  for (const asset of assets) {
    if (asset.status === "In Stock") stock.set(asset.asset_type || "", (stock.get(asset.asset_type || "") || 0) + 1);
  }
  const specs = assets.filter(canHaveSpecs);

  return {
    total: assets.length,
    statuses: [...statusCounts].map(([status, count]) => ({ status, count })),
    types: groupBy(assets, "asset_type"),
    locations: groupBy(assets, "location", 8),
    stock: [...stock].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    specs: { total: specs.length, imported: specs.filter((asset) => asset.specs_imported_date).length },
    issues: Object.entries(ASSET_ISSUES)
      .filter(([key]) => key !== "noSpecs")
      .map(([key, { label, done, match }]) => ({ key, label, done, count: assets.filter((asset) => match(asset, today)).length })),
    withWarranty: assets.filter((asset) => asset.warranty_end).length,
  };
}

// ตัวกรองจากลิงก์ เช่น /assets?type=Notebook&status=In+Stock · ค่าที่ไม่รู้จักถูกตัดทิ้ง
export function parseAssetLinkFilters(params) {
  const filters = {};
  for (const key of ["type", "status", "location", "issue"]) {
    const value = params?.[key];
    if (typeof value === "string" && value && value.length <= 200) filters[key] = value;
  }
  if (filters.issue && !Object.hasOwn(ASSET_ISSUES, filters.issue)) delete filters.issue;
  return Object.keys(filters).length ? filters : null;
}

export function assetListHref(filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  return query ? `/assets?${query}` : "/assets";
}
