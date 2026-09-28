/**
 * สร้างชื่อพนักงานสำหรับแสดงบนหน้าจอและรายงาน
 *
 * nickname เป็นข้อมูลช่วยแยกบุคคลตอนแสดงผลเท่านั้น การเลือกและบันทึกข้อมูล
 * ต้องยังใช้ user.id เป็น Foreign Key จึงไม่มีการเขียนชื่อเล่นลงใน Asset
 */
export function formatUserDisplayName(user) {
  const fullName =
    typeof user?.full_name === "string" ? user.full_name.trim() : "";
  const nickname =
    typeof user?.nickname === "string" ? user.nickname.trim() : "";

  if (!fullName) return nickname ? `(${nickname})` : "";

  return nickname ? `${fullName} (${nickname})` : fullName;
}
