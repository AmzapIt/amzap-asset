import assert from 'node:assert/strict';
import test from 'node:test';
import { selectBatchVerificationUsers, selectPrintableVerificationRecords,
  verificationNumber } from '../lib/asset-verifications.js';
import { assetVerificationBatchPdf, assetVerificationPdf,
  verificationEquipmentRowCount } from '../lib/export-files.js';
import { isAmzapVerificationUser } from '../lib/verification-eligibility.js';

const pdfPageCount = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

test('verification equipment table has at least five rows and never truncates extras', () => {
  assert.equal(verificationEquipmentRowCount(0), 5);
  assert.equal(verificationEquipmentRowCount(4), 5);
  assert.equal(verificationEquipmentRowCount(5), 5);
  assert.equal(verificationEquipmentRowCount(8), 8);
});

test('AV number includes calendar year, round, and per-round sequence', () => {
  assert.equal(verificationNumber(2026, 1, 1), 'AV-2026-01-0001');
  assert.equal(verificationNumber(2026, 2, 15), 'AV-2026-02-0015');
  assert.throws(() => verificationNumber(2026, 0, 1));
  assert.throws(() => verificationNumber(2026, 1, 10000));
});

test('periodic verification renders a PDF from a saved snapshot', async () => {
  const record = {
    document_no: 'AV-2026-01-0001', form_revision: 'FM-IT-002 Rev.00',
    year: 2026, round_no: 1,
    snapshot: {
      employee: { full_name: 'ทดสอบ พนักงาน', employee_code: 'TEST001', department: 'IT', position: 'Tester' },
      issued_date: '2026-10-14',
      assets: Array.from({ length: 12 }, (_, i) => ({ asset_code: `F1-NB-${String(i + 1).padStart(3, '0')}`,
        asset_type: 'Notebook', brand: 'Brand', model: 'Model', serial_number: `SN${i + 1}` })),
      accessories: [{ accessory_type: 'Mouse', brand: 'Brand', model: 'M1', serial_number: null, quantity: 1 }],
    },
  };
  const buffer = await assetVerificationPdf(record);
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
});

test('bulk reprint includes all numbered asset forms regardless of legacy source', () => {
  const asset = { holder_source: 'Assignment' };
  const legacy = { holder_source: 'Asset Owner (legacy)' };
  const records = [
    { id: '1', status: 'issued', snapshot: { assets: [asset] } },
    { id: '2', status: 'signed', snapshot: { assets: [legacy] } },
    { id: '3', status: 'issued', snapshot: { assets: [] } },
    { id: '4', status: 'cancelled', snapshot: { assets: [asset] } },
  ];
  assert.deepEqual(selectPrintableVerificationRecords(records).map((record) => record.id), ['1', '2']);
});

test('one-click batch selects active Amzap asset holders and reuses their existing forms', () => {
  const users = [{ id: '1', is_active: true, location_id: '1' },
    { id: '2', is_active: true, location_id: '2' },
    { id: '3', is_active: true, location_id: '3' },
    { id: '4', is_active: false, location_id: '1' }];
  const assets = [
    { id: '11', current_holder_id: '1', holder_source: 'Assignment' },
    { id: '12', current_holder_id: '2', holder_source: 'Asset Owner (legacy)' },
    { id: '13', current_holder_id: '3', holder_source: 'Assignment' },
    { id: '14', current_holder_id: '4', holder_source: 'Assignment' },
  ];
  const oldForm = { id: '21', user_id: '1', status: 'issued', snapshot: { assets: [assets[0]] } };
  const selected = selectBatchVerificationUsers(users, assets, [oldForm]);
  assert.deepEqual(selected.map(({ user }) => user.id), ['1', '2']);
  assert.equal(selected[0].existing, oldForm);
  assert.equal(selected[1].existing, undefined);
  assert.equal(isAmzapVerificationUser(users[2]), false);
});

test('bulk PDF combines saved employee forms without issuing anything', async () => {
  const record = (id) => ({
    id, document_no: `AV-2026-01-000${id}`, form_revision: 'FM-IT-002 Rev.00',
    year: 2026, round_no: 1,
    snapshot: { employee: { full_name: `พนักงาน ${id}`, employee_code: `T${id}` },
      issued_date: '2026-10-14', assets: [{ asset_code: `F1-NB-00${id}`, asset_type: 'Notebook' }],
      accessories: [] },
  });
  const buffer = await assetVerificationBatchPdf([record('1'), record('2')]);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 1000);
  assert.equal(pdfPageCount(buffer), 2);
});

test('ordinary asset verification fits on one A4 page', async () => {
  const buffer = await assetVerificationPdf({
    document_no: 'AV-2026-01-0003', form_revision: 'FM-IT-002 Rev.00',
    year: 2026, round_no: 1,
    snapshot: { employee: { full_name: 'พนักงาน ทดสอบ', employee_code: 'T003' },
      issued_date: '2026-10-15',
      assets: Array.from({ length: 3 }, (_, index) => ({
        asset_code: `F1-NB-00${index + 1}`, asset_type: 'Notebook', brand: 'Brand',
        model: 'Model', serial_number: `SN-${index + 1}` })),
      accessories: [{ accessory_type: 'Mouse', brand: 'Brand', model: 'Model', quantity: 1 }],
    },
  });
  assert.equal(pdfPageCount(buffer), 1);
});
