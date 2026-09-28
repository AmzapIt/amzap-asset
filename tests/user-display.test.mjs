import assert from "node:assert/strict";
import test from "node:test";

import { formatUserDisplayName } from "../lib/user-display.js";

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
