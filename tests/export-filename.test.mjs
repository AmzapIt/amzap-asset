import assert from "node:assert/strict";
import test from "node:test";

import {
  filenameFromContentDisposition,
  handoverFilename,
  sanitizeFilenamePart,
} from "../lib/export-filename.js";

test("ใบรับมอบใช้ชื่อจริงและชื่อเล่นของพนักงานในชื่อไฟล์", () => {
  assert.equal(
    handoverFilename({ full_name: "สมชาย ใจดี", nickname: "เอ" }),
    "AMZAP-สมชาย ใจดี (เอ).pdf",
  );
});

test("ชื่อไฟล์ตัดอักขระที่ใช้ไม่ได้บน Windows และโทรศัพท์", () => {
  assert.equal(sanitizeFilenamePart(" ../สม/ชาย: ทดสอบ? "), "สม-ชาย- ทดสอบ");
});

test("หน้าเว็บอ่านชื่อภาษาไทยจาก Content-Disposition", () => {
  const filename = "AMZAP-สมชาย ใจดี.pdf";
  const header = `attachment; filename="AMZAP-handover.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`;

  assert.equal(filenameFromContentDisposition(header, "fallback.pdf"), filename);
});
