import { formatUserDisplayName } from "./user-display.js";

// ตัดอักขระที่ระบบปฏิบัติการไม่อนุญาตในชื่อไฟล์ และจำกัดความยาวของชื่อบุคคล
// เพื่อให้ดาวน์โหลดได้ทั้ง Windows, iPhone และ Android
export function sanitizeFilenamePart(value, fallback = "user") {
  const sanitized = String(value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 120)
    .trim()
    .replace(/[. -]+$/g, "");

  return sanitized || fallback;
}

export function handoverFilename(recipient) {
  const displayName = formatUserDisplayName(recipient);
  return `AMZAP-${sanitizeFilenamePart(displayName)}.pdf`;
}

// fetch + Blob จะไม่ใช้ Content-Disposition ให้อัตโนมัติ จึงอ่าน filename*=UTF-8
// แล้วกำหนดให้ download attribute เพื่อรักษาชื่อภาษาไทยที่ Server ส่งมา
export function filenameFromContentDisposition(header, fallback) {
  if (typeof header !== "string") return fallback;

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ""));
    } catch {
      return fallback;
    }
  }

  const basicMatch = header.match(/filename="([^"]+)"/i);
  return basicMatch?.[1] || fallback;
}

export function returnFormFilename(employee) {
  return `AMZAP-ใบคืนทรัพย์สิน-${sanitizeFilenamePart(formatUserDisplayName(employee))}.pdf`;
}
