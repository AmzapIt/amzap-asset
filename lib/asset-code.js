const positiveBigintPattern = /^[1-9]\d{0,18}$/;
const siteCodePattern = /^F\d{1,3}$/;
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

export function buildAssetCode(siteCode, typePrefix, codeNumber) {
  const normalizedSite = String(siteCode || "").trim().toUpperCase();
  const normalizedPrefix = String(typePrefix || "").trim().toUpperCase();
  const normalizedNumber = parseAssetCodeNumber(codeNumber);

  if (!siteCodePattern.test(normalizedSite)) {
    throw new Error("รหัสสถานที่ขึ้นทะเบียนไม่ถูกต้อง");
  }
  if (!typePrefixPattern.test(normalizedPrefix)) {
    throw new Error("Prefix ของประเภททรัพย์สินไม่ถูกต้อง");
  }

  return `${normalizedSite}-${normalizedPrefix}-${normalizedNumber}`;
}

/**
 * Build a display-only preview. The database allocates the real running
 * number inside a transaction, so the preview deliberately uses XXX and never
 * promises a number that another request could take first.
 */
export function buildAssetCodePreview(siteCode, typePrefix, codeNumber = "") {
  const normalizedSite = String(siteCode || "").trim().toUpperCase();
  const normalizedPrefix = String(typePrefix || "").trim().toUpperCase();

  if (!siteCodePattern.test(normalizedSite)) return "---";
  if (!typePrefixPattern.test(normalizedPrefix)) return `${normalizedSite}----`;

  const suffix = /^\d{3}$/.test(codeNumber) ? codeNumber : "XXX";
  return `${normalizedSite}-${normalizedPrefix}-${suffix}`;
}
