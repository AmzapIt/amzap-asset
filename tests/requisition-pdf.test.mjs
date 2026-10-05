import assert from 'node:assert/strict';
import test from 'node:test';
import { requisitionDefinition, requisitionPdf, handoverPdf } from '../lib/export-files.js';

const fixture = () => ({ id: '42', requested_date: '2026-10-05', request_kind: 'additional',
  employee_snapshot: { full_name: 'สมชาย ใจดี', nickname: 'บอย', employee_code: 'AMZ-101',
    department_name: 'บัญชี', position: 'เจ้าหน้าที่บัญชี', location_name: 'Amzap โรงงาน 1' },
  items: [{ name: 'Monitor', quantity: 2, details: 'จอ 24 นิ้ว', originalAssetCode: '' }],
  reason: 'เพิ่มจอสำหรับทำงานเอกสาร', it_staff_name: 'เจ้าหน้าที่ทดสอบ', created_by_name: 'IT Staff' });

test('requisition uses the AMZAP A4 template with three blank signatures, not a handover confirmation', () => {
  const input = fixture();
  const before = structuredClone(input);
  const document = requisitionDefinition(input);
  assert.equal(document.pageSize, 'A4');
  assert.equal(document.defaultStyle.font, 'Sarabun');
  assert.deepEqual(document.pageMargins, [35,35,35,40]);
  assert.match(document.content[0].columns[0].image, /^data:image\/png;base64,/);
  const text = JSON.stringify(document);
  for (const label of ['REQ-000042', '05/10/2026', 'สมชาย ใจดี (บอย)', 'เจ้าหน้าที่ IT', 'ผู้อนุมัติ / ผู้บังคับบัญชา', 'ใบนี้เป็นคำขอเท่านั้น']) assert.ok(text.includes(label));
  assert.ok(!text.includes('ยืนยันว่าได้รับอุปกรณ์ครบถ้วน'));
  assert.equal((text.match(/ลายเซ็น/g) || []).length, 3);
  const equipment = document.content.find((node) => node.table?.headerRows === 1);
  assert.equal(equipment.table.body.length, 6);
  assert.equal(equipment.table.body[1].length, 4);
  assert.equal(equipment.table.body[1][3], '2');
  assert.ok(text.includes('เจ้าหน้าที่ทดสอบ'));
  assert.deepEqual(input, before);
});

test('replacement retains original codes and all 20 lines without imposing handover limits', () => {
  const input = fixture();
  input.request_kind = 'replacement';
  input.items = Array.from({length:20}, (_, index) => ({ name: 'Notebook', quantity: 1,
    details: 'รายละเอียดหลายบรรทัด\nบรรทัดที่สอง', returnedAssetCode: `F1-OLD-${index+1}`,
    replacementAssetCode: `F1-NEW-${index+1}` }));
  const document = requisitionDefinition(input);
  const equipment = document.content.find((node) => node.table?.headerRows === 1);
  assert.equal(equipment.table.body.length, 21);
  assert.equal(equipment.table.body[20].length, 6);
  assert.equal(equipment.table.body[20][2], 'F1-OLD-20');
  assert.equal(equipment.table.body[20][3], 'F1-NEW-20');
  const signing = document.content.find((node) => node.unbreakable);
  assert.equal(signing.stack[1].table.dontBreakRows, true);
});

test('both request variants and the existing handover still generate valid PDF buffers', async () => {
  for (const request_kind of ['additional','replacement']) {
    const input = { ...fixture(), request_kind };
    const buffer = await requisitionPdf(input);
    assert.equal(buffer.subarray(0,5).toString(), '%PDF-');
    assert.ok(buffer.length > 10000);
  }
  const pdf = await handoverPdf([{ asset_code: 'TEST-001', asset_type: 'Monitor' }],
    {full_name:'ทดสอบ',employee_code:'TEST'}, { kind:'รับเพิ่ม' });
  assert.equal(pdf.subarray(0,5).toString(), '%PDF-');
});
