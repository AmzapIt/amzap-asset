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

function employeeCompany(user) {
  const location = typeof user?.location_name === "string"
    ? user.location_name.trim().toLowerCase()
    : "";
  return location.startsWith("amzap ") || location === "amzap"
    ? "Amzap"
    : location === "memorize" ? "Memo" : "";
}

// Company labels are for employee selection only; stored names and user IDs stay unchanged.
export function formatEmployeeOptionLabel(user, { showCode = true } = {}) {
  const employeeCode = showCode && typeof user?.employee_code === "string"
    ? user.employee_code.trim()
    : "";

  return [employeeCompany(user), employeeCode, formatUserDisplayName(user)]
    .filter(Boolean)
    .join(" — ");
}

// Keep the source's name order inside each company and never mutate the supplied list.
export function orderEmployeesByCompany(users) {
  const rank = (user) => user?.id === "unassigned" ? -1
    : employeeCompany(user) === "Amzap" ? 0
      : employeeCompany(user) === "Memo" ? 1 : 2;
  return [...users].sort((a, b) => rank(a) - rank(b));
}
