import assert from 'node:assert/strict';
import test from 'node:test';
import { returnFormDefinition, returnFormPdf } from '../lib/export-files.js';
import { returnFormFilename } from '../lib/export-filename.js';

const employee = { full_name: 'สมชาย ใจดี', nickname: 'บอย', employee_code: 'AMZ-101', department: 'บัญชี', position: 'เจ้าหน้าที่' };
const assets = [{ asset_code: 'F1-NB-001', asset_type: 'Notebook', brand: 'Dell', model: 'Latitude', serial_number: 'SN1' }];
const accessories = [{ accessory_type: 'Mouse', brand: 'Logitech', quantity: 2 }];

test('return form lists current holdings with blank handwritten result column and three signatures', () => {
  const doc = returnFormDefinition(employee, assets, accessories);
  const text = JSON.stringify(doc);
  for (const label of ['สมชาย ใจดี (บอย)', 'AMZ-101', 'F1-NB-001', 'Asset: Notebook', 'Accessory: Mouse', 'ผลการตรวจรับ / สภาพ', 'ผู้คืน (พนักงาน)', 'ผู้รับคืน / ฝ่าย IT', 'วันที่คืน'])
    assert.ok(text.includes(label), label);
  for (const absent of ['สถานะในระบบ', 'คืนแล้ว', 'License']) assert.ok(!text.includes(absent), absent);
  assert.equal((text.match(/ลายเซ็น/g) || []).length, 3);
  const table = doc.content.find((node) => node.table?.headerRows === 1);
  assert.equal(table.table.body.length, 1 + 8); // 2 items + blank rows, minimum 8
  assert.equal(table.table.body[2][4], '2');
  assert.equal(table.table.body[1][5], ' ');
});

test('always leaves at least three blank rows and renders a PDF', async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...assets[0], asset_code: `F1-NB-${i}` }));
  const table = returnFormDefinition(employee, many).content.find((node) => node.table?.headerRows === 1);
  assert.equal(table.table.body.length, 1 + 13);
  const buffer = await returnFormPdf(employee, assets, accessories);
  assert.equal(Buffer.from(buffer).subarray(0, 4).toString(), '%PDF');
});

test('filename is safe and Thai', () => {
  assert.equal(returnFormFilename(employee), 'AMZAP-ใบคืนทรัพย์สิน-สมชาย ใจดี (บอย).pdf');
});

test('IT signer name from settings fills the IT signature box only', () => {
  const text = JSON.stringify(returnFormDefinition(employee, assets, accessories, 'วัชรกร ไอที'));
  assert.ok(text.includes('ชื่อ วัชรกร ไอที'));
  assert.equal((text.match(/วัชรกร ไอที/g) || []).length, 1);
});
