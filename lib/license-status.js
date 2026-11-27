// สถานะและการเรียง License ใช้ได้ทั้ง browser และ server (ไม่มี import ฝั่ง server)

const DAY = 86400000;
const ORDER = { expired: 0, soon: 1, noExpiry: 2, ok: 3, inactive: 4 };

export function licenseStatus(license, today) {
  if (!license.is_active) return { key: "inactive", label: "ปิดใช้งาน", days: null };
  if (!license.expiration_date) return { key: "noExpiry", label: "ไม่มีวันหมดอายุ", days: null };
  const days = Math.round((Date.parse(`${String(license.expiration_date).slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days < 0) return { key: "expired", label: `เลยกำหนด ${-days} วัน`, days };
  if (days <= 30) return { key: "soon", label: days === 0 ? "หมดอายุวันนี้" : `เหลือ ${days} วัน`, days };
  return { key: "ok", label: `เหลือ ${days} วัน`, days };
}

// เลยกำหนด → ใกล้หมด → ไม่มีวันหมดอายุ → ปกติ → ปิดใช้งาน
export function sortLicenses(licenses, today) {
  return licenses
    .map((license) => ({ license, status: licenseStatus(license, today) }))
    .sort((a, b) => ORDER[a.status.key] - ORDER[b.status.key]
      || (a.status.days ?? 0) - (b.status.days ?? 0)
      || a.license.name.localeCompare(b.license.name, "th"));
}

export const LICENSE_FILTERS = {
  all: { label: "ทั้งหมด", match: () => true },
  attention: { label: "ใกล้หมด / เลยกำหนด", match: (key) => key === "expired" || key === "soon" },
  noExpiry: { label: "ไม่มีวันหมดอายุ", match: (key) => key === "noExpiry" },
  inactive: { label: "ปิดใช้งาน", match: (key) => key === "inactive" },
};

// ค้นจากชื่อ License, ผู้ขาย, ผู้ได้รับสิทธิ์ และรหัสเครื่อง
export function matchesLicenseSearch(license, assignments, text) {
  const needle = String(text || "").trim().toLocaleLowerCase();
  if (!needle) return true;
  const words = [license.name, license.vendor_name];
  for (const a of assignments) words.push(a.full_name, a.nickname, a.employee_code, a.asset_code, a.asset_name, a.user_devices);
  return words.filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
}

// บัญชี Read-only ไม่ได้รับหมายเหตุ ราคา และ Product Key ท้าย 4 ตัว
export function redactLicenseInventory(inventory, includePrivate) {
  if (includePrivate) return inventory;
  return {
    ...inventory,
    licenses: inventory.licenses.map((license) => {
      const copy = { ...license };
      for (const key of ["notes", "purchase_cost", "product_key_hint"]) delete copy[key];
      return copy;
    }),
  };
}
