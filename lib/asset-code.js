const positiveBigintPattern = /^[1-9]\d{0,18}$/;
const siteCodePattern = /^(?:F\d{1,3}|M1)$/;
const typePrefixPattern = /^[A-Z0-9]{2,10}$/;

/**
 * Validate a registration-site ID received from a form without coercing it to
 * Number. PostgreSQL IDs are bigint, so keeping the value as a string avoids
 * losing precision in the browser or API.
 */
export function parseRegistrationSiteId(value) {
  if (typeof value !== "string" || !positiveBigintPattern.test(value)) {
    throw new Error("กรุณาเลือกสถานที่ขึ้นทะเบียน");
  }

  if (BigInt(value) > 9223372036854775807n) {
    throw new Error("สถานที่ขึ้นทะเบียนไม่ถูกต้อง");
  }

  return value;
}

/**
 * The Add form keeps the familiar three-digit input (001-999 format) while
 * the server remains responsible for composing the complete Asset Code.
 */
export function parseAssetCodeNumber(value) {
  if (typeof value !== "string" || !/^\d{3}$/.test(value)) {
    throw new Error("กรุณากรอกเลข Asset Code ให้ครบ 3 หลัก เช่น 001");
  }

  return value;
}

/**
 * Format MAX() results from PostgreSQL for the Add form. PostgreSQL may return
 * a number or numeric string depending on the expression, but the browser must
 * always receive the familiar three-digit Running Number.
 */
export function formatAssetCodeNumber(value) {
  if (value === null || value === undefined) return null;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0 || number > 999) {
    throw new Error("เลข Running Asset ไม่ถูกต้อง");
  }

  return String(number).padStart(3, "0");
}

// รหัสรูปแบบใหม่: {กลุ่มบริษัท}{ปี ค.ศ. 2 หลัก}-{ประเภท}-{เลข 3 หลัก} เช่น AMZAP26-NB-001
// สาขาไม่อยู่ในรหัส เพราะเครื่องย้ายสาขาได้ แต่รหัสต้องคงที่ตลอดอายุเครื่อง
const CODE_GROUPS = { F: "AMZAP", M: "MEMO" };
// รหัสเดิม F1/F2/M1 ทั้งหมดถูกแปลงเป็นปี 26 จึงนับรวมในเลขรันของปีนี้เท่านั้น
const LEGACY_CODE_YEAR = "26";

export function assetCodeGroup(siteCode) {
  const normalizedSite = String(siteCode || "").trim().toUpperCase();
  if (!siteCodePattern.test(normalizedSite)) return null;
  return CODE_GROUPS[normalizedSite[0]] || null;
}

/** ปี ค.ศ. 2 หลักตามเวลาไทย เพื่อไม่ให้ช่วงข้ามปีออกรหัสผิดปี */
export function assetCodeYear(date = new Date()) {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(date);
  return year.slice(-2);
}

/**
 * Regex (PostgreSQL/JS) ของรหัสที่อยู่ในชุดเลขรันเดียวกัน: กลุ่มเดียวกัน ปีเดียวกัน
 * ประเภทเดียวกัน ปี 26 นับรหัสเดิมของกลุ่มด้วย เพื่อไม่ให้ชนตอนแปลงรหัสเดิม
 */
export function assetCodeSeriesPattern(siteCode, typePrefix, year = assetCodeYear()) {
  const group = assetCodeGroup(siteCode);
  const prefix = String(typePrefix || "").trim().toUpperCase();
  if (!group || !typePrefixPattern.test(prefix) || !/^\d{2}$/.test(year)) {
    throw new Error("ไม่สามารถหาชุดเลขรันของ Asset Code ได้");
  }
  const legacy = year === LEGACY_CODE_YEAR ? (group === "MEMO" ? "|M1" : "|F[0-9]{1,3}") : "";
  return `^(${group}${year}${legacy})-${prefix}-[0-9]{3}$`;
}

export function buildAssetCode(siteCode, typePrefix, codeNumber, year = assetCodeYear()) {
  const normalizedPrefix = String(typePrefix || "").trim().toUpperCase();
  const normalizedNumber = parseAssetCodeNumber(codeNumber);
  const group = assetCodeGroup(siteCode);

  if (!group) {
    throw new Error("รหัสสถานที่ขึ้นทะเบียนไม่ถูกต้อง");
  }
  if (!typePrefixPattern.test(normalizedPrefix)) {
    throw new Error("Prefix ของประเภททรัพย์สินไม่ถูกต้อง");
  }

  return `${group}${year}-${normalizedPrefix}-${normalizedNumber}`;
}

/**
 * Build a display-only preview. The create API recomposes the full code from
 * trusted Site/Type records and rejects a Running Number already used in the
 * same company group, year and Asset Type.
 */
export function buildAssetCodePreview(siteCode, typePrefix, codeNumber = "", year = assetCodeYear()) {
  const group = assetCodeGroup(siteCode);
  const normalizedPrefix = String(typePrefix || "").trim().toUpperCase();

  if (!group) return "---";
  if (!typePrefixPattern.test(normalizedPrefix)) return `${group}${year}----`;

  const suffix = /^\d{3}$/.test(codeNumber) ? codeNumber : "XXX";
  return `${group}${year}-${normalizedPrefix}-${suffix}`;
}
