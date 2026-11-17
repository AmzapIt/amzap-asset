// สร้างไฟล์ Excel เทียบรหัส Asset เดิม -> ใหม่ (อ่านอย่างเดียว ไม่แก้ฐานข้อมูล)
import ExcelJS from "exceljs";
import { getReportAssets } from "../lib/asset-report.js";
import { query } from "../lib/db.js";

const YEAR = "26";
const assets = await getReportAssets();
const legacy = new Map((await query("SELECT asset_code, history_assets FROM public.assets")).rows
  .map((r) => [r.asset_code, r.history_assets || ""]));
const sortKey = (c) => { const [s, t, n] = c.split("-"); return `${s[0] === "F" ? 0 : 1}|${t}|${n}`; };
const rows = [...assets].sort((a, b) => sortKey(a.asset_code).localeCompare(sortKey(b.asset_code)));

const newCode = (code) => {
  const [site, type, num] = code.split("-");
  const prefix = site.startsWith("F") ? "AMZAP" : site.startsWith("M") ? "MEMO" : null;
  return prefix ? `${prefix}${YEAR}-${type}-${num}` : "";
};

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("เทียบรหัส");
ws.columns = [
  { header: "ลำดับ", key: "no", width: 7 },
  { header: "รหัสปัจจุบัน", key: "old", width: 16 },
  { header: "รหัสใหม่", key: "new", width: 18 },
  { header: "รหัสรุ่นเก่า (history)", key: "legacy", width: 20 },
  { header: "ผู้ถือครองปัจจุบัน", key: "holder", width: 28 },
  { header: "แผนก", key: "dept", width: 18 },
  { header: "ประเภท", key: "type", width: 14 },
  { header: "Brand", key: "brand", width: 12 },
  { header: "Model", key: "model", width: 24 },
  { header: "Serial Number", key: "sn", width: 22 },
  { header: "สถานะ", key: "status", width: 12 },
  { header: "สถานที่ปัจจุบัน", key: "loc", width: 18 },
  { header: "หมายเหตุ", key: "note", width: 22 },
];
const seen = new Map();
for (const r of rows) { const n = newCode(r.asset_code); seen.set(n, (seen.get(n) || 0) + 1); }
let dup = 0;
rows.forEach((r, i) => {
  const n = newCode(r.asset_code);
  let note = "";
  if (!n) note = "ไม่รู้จักรหัสสาขา";
  else if (seen.get(n) > 1) { note = "รหัสใหม่ซ้ำ"; dup++; }
  ws.addRow({ no: i + 1, old: r.asset_code, new: n, legacy: legacy.get(r.asset_code), holder: r.current_holder || "-",
    dept: r.department || "", type: r.asset_type, brand: r.brand, model: r.model, sn: r.serial_number,
    status: r.status, loc: r.location, note });
});
ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
ws.getColumn("new").font = { bold: true, color: { argb: "FF1D4ED8" } };
ws.views = [{ state: "frozen", ySplit: 1 }];
ws.autoFilter = { from: "A1", to: "M1" };

// สรุปจำนวน + เลขที่ข้าม แยกตาม prefix/ประเภท
const sum = wb.addWorksheet("สรุป");
sum.columns = [{ header: "กลุ่ม", key: "g", width: 18 }, { header: "จำนวน", key: "n", width: 10 },
  { header: "เลขสูงสุด", key: "m", width: 12 }, { header: "เลขที่ข้าม", key: "miss", width: 30 }];
const groups = new Map();
for (const r of rows) { const [p, t, num] = newCode(r.asset_code).split("-"); const k = `${p}-${t}`;
  (groups.get(k) || groups.set(k, []).get(k)).push(+num); }
for (const [g, nums] of groups) {
  const max = Math.max(...nums); const set = new Set(nums); const miss = [];
  for (let i = 1; i <= max; i++) if (!set.has(i)) miss.push(String(i).padStart(3, "0"));
  sum.addRow({ g, n: nums.length, m: String(max).padStart(3, "0"), miss: miss.join(", ") || "-" });
}
sum.addRow({});
sum.addRow({ g: "รวม", n: rows.length });
sum.addRow({ g: "รหัสใหม่ซ้ำ", n: dup });
sum.getRow(1).font = { bold: true };

await wb.xlsx.writeFile("work/asset-code-mapping-amzap.xlsx");
console.log(`rows=${rows.length} duplicates=${dup} noHolder=${rows.filter((r) => !r.current_holder).length}`);
process.exit(0);
