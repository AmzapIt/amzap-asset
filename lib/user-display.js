/**
 * สร้างชื่อสำหรับ Dropdown ที่ให้เลือกพนักงาน
 *
 * nickname เป็นข้อมูลช่วยแยกบุคคลในหน้าจอเท่านั้น ค่า value ของ option
 * ต้องยังเป็น user.id เพื่อไม่ให้ชื่อหรือชื่อเล่นถูกใช้เป็น Foreign Key
 */
export function formatUserDisplayName(user) {
  const fullName =
    typeof user?.full_name === "string" ? user.full_name.trim() : "";
  const nickname =
    typeof user?.nickname === "string" ? user.nickname.trim() : "";

  return nickname ? `${fullName} (${nickname})` : fullName;
}
