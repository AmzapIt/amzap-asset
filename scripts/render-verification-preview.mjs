import { mkdir, writeFile } from 'node:fs/promises';
import { assetVerificationPdf } from '../lib/export-files.js';

const record = {
  document_no: 'AV-2026-01-0001', form_revision: 'FM-IT-002 Rev.00',
  year: 2026, round_no: 1,
  snapshot: {
    employee: { full_name: 'ตัวอย่าง พนักงาน', employee_code: 'EXAMPLE001',
      department: 'ฝ่าย IT', position: 'พนักงาน' },
    issued_date: '2026-10-14',
    assets: [
      { asset_code: 'F1-NB-001', asset_type: 'Notebook', brand: 'Lenovo', model: 'ThinkPad', serial_number: 'EXAMPLE-SN-1' },
      { asset_code: 'F1-MON-001', asset_type: 'Monitor', brand: 'Dell', model: 'P24', serial_number: 'EXAMPLE-SN-2' },
    ],
    accessories: [{ accessory_type: 'Mouse', brand: 'Logitech', model: 'M185', serial_number: null, quantity: 1 }],
  },
};

await mkdir('output/pdf', { recursive: true });
await writeFile('output/pdf/asset-verification-sample.pdf', await assetVerificationPdf(record));
console.log('output/pdf/asset-verification-sample.pdf');
