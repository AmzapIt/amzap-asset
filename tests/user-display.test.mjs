import assert from "node:assert/strict";
import test from "node:test";

import {
  formatEmployeeOptionLabel,
  formatUserDisplayName,
  orderEmployeesByCompany,
} from "../lib/user-display.js";

test("แสดงชื่อจริงและชื่อเล่นในวงเล็บ", () => {
  assert.equal(
    formatUserDisplayName({ full_name: "วัจน์กร ถือนิล", nickname: "เดย์" }),
    "วัจน์กร ถือนิล (เดย์)",
  );
});

test("ไม่มีชื่อเล่นให้แสดงเฉพาะชื่อจริง", () => {
  assert.equal(
    formatUserDisplayName({ full_name: "วัจน์กร ถือนิล", nickname: null }),
    "วัจน์กร ถือนิล",
  );
});

test("ตัดช่องว่างก่อนจัดรูปแบบชื่อ", () => {
  assert.equal(
    formatUserDisplayName({ full_name: "  สมชาย ใจดี  ", nickname: " เอ " }),
    "สมชาย ใจดี (เอ)",
  );
});

test("ตัวเลือกพนักงาน Amzap มีชื่อบริษัทด้านหน้าโดยไม่เปลี่ยนชื่อจริง", () => {
  const user = {
    full_name: "สมชาย ใจดี",
    nickname: "เอ",
    employee_code: " A001 ",
    location_name: "Amzap โรงงาน 1",
  };
  assert.equal(formatEmployeeOptionLabel(user), "Amzap — A001 — สมชาย ใจดี (เอ)");
  assert.equal(formatUserDisplayName(user), "สมชาย ใจดี (เอ)");
});

test("ตัวเลือกพนักงาน Memorize แสดง Memo และซ่อนรหัสได้", () => {
  const user = { full_name: "พิมพ์ผกา วิภาหา", location_name: "Memorize" };
  assert.equal(formatEmployeeOptionLabel(user), "Memo — พิมพ์ผกา วิภาหา");
  assert.equal(
    formatEmployeeOptionLabel({ ...user, employee_code: "M001" }, { showCode: false }),
    "Memo — พิมพ์ผกา วิภาหา",
  );
});

test("ไม่มี Location ไม่เดาบริษัทให้พนักงาน", () => {
  assert.equal(
    formatEmployeeOptionLabel({ full_name: "ไม่ระบุที่ตั้ง", employee_code: "X001" }),
    "X001 — ไม่ระบุที่ตั้ง",
  );
});

test("เรียงตัวเลือก Amzap ก่อน Memo แล้วตามด้วยผู้ที่ไม่ระบุ Location", () => {
  const users = [
    { id: "memo", location_name: "Memorize" },
    { id: "unknown" },
    { id: "amzap-2", location_name: "Amzap โรงงาน 2" },
    { id: "unassigned" },
    { id: "amzap-1", location_name: "Amzap โรงงาน 1" },
  ];

  assert.deepEqual(orderEmployeesByCompany(users).map((user) => user.id), [
    "unassigned", "amzap-2", "amzap-1", "memo", "unknown",
  ]);
  assert.equal(users[0].id, "memo");
});
