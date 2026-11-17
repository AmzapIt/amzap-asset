import Link from 'next/link';
import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getRequisitionOptions, listRequisitions } from '@/lib/asset-requisitions';
import { formatUserDisplayName } from '@/lib/user-display';
import ReportsShell, { ReportLoadError } from '../ReportsShell';
import RequisitionForm from './RequisitionForm';
import { getItSignerName } from '@/lib/document-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const single = (value) => typeof value === 'string' ? value : '';

export default async function RequisitionsPage({ searchParams }) {
  const account = await workflowPageAccount();
  const params = await searchParams;
  const search = single(params.q).slice(0, 200);
  const kind = ['additional', 'replacement'].includes(params.kind) ? params.kind : '';
  const page = /^\d{1,6}$/.test(single(params.page)) ? Math.max(1, Math.min(100000, Number(params.page))) : 1;
  let history, options = { users: [], types: [], stockAssets: [], heldAssets: [] }, itSignerName = '';
  try {
    [history, options, itSignerName] = await Promise.all([
      listRequisitions({ search, kind, page }),
      account.canWrite ? getRequisitionOptions() : options,
      account.canWrite ? getItSignerName() : '',
    ]);
  } catch (error) {
    console.error('Requisition report load failed', error);
    return <ReportLoadError retryHref="/reports/requisitions" />;
  }
  const initialUserId = options.users.some((u) => u.id === single(params.userId)) ? params.userId : '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pageHref = (next) => `/reports/requisitions?${new URLSearchParams({ q: search, kind, page: String(next) })}#history`;
  return (
    <ReportsShell view="requisitions" canViewOperational={account.canWrite} title="ใบขอเบิก / เปลี่ยนอุปกรณ์"
      description="บันทึกคำขอ พิมพ์ให้เซ็น และค้นหาใบเดิม — ไม่เปลี่ยนเจ้าของ ไม่ตัดคลัง และไม่รับคืนอัตโนมัติ">
      {account.canWrite && <RequisitionForm {...options} initialUserId={initialUserId} today={today} defaultItStaffName={itSignerName} />}
      <section id="history" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">ประวัติใบขอเบิก</h2>
        <form action="/reports/requisitions#history" className="my-4 flex flex-wrap items-end gap-3">
          <label className="min-w-60 flex-1 text-sm">ค้นหาเลขใบขอเบิก / ชื่อ / ชื่อเล่น / Employee Code
            <input name="q" type="search" defaultValue={search} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">ประเภทคำขอ<select name="kind" defaultValue={kind} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2">
            <option value="">ทั้งหมด</option><option value="additional">ขอเพิ่ม</option><option value="replacement">เปลี่ยนทดแทน / คืน</option>
          </select></label>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white">ค้นหา</button>
          <Link href="/reports/requisitions#history" className="px-2 py-2 text-sm text-blue-700">ล้างตัวกรอง</Link>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50"><tr>{['เลขที่ใบขอเบิก', 'วันที่ขอ', 'พนักงาน', 'ประเภท', 'อุปกรณ์', 'เอกสาร'].map((label) => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead>
            <tbody>{history.rows.map((row) => <tr key={row.id} className="border-t border-slate-100">
              <td className="whitespace-nowrap p-3 font-medium">REQ-{row.id.padStart(6, '0')}</td>
              <td className="whitespace-nowrap p-3">{row.requested_date.split('-').reverse().join('/')}</td>
              <td className="p-3"><p>{formatUserDisplayName(row.employee_snapshot)}</p><p className="text-xs text-slate-500">{row.employee_snapshot.employee_code || '—'} · {row.employee_snapshot.department_name || '—'}</p></td>
              <td className="whitespace-nowrap p-3">{row.request_kind === 'replacement' ? 'เปลี่ยนทดแทน / คืน' : 'ขอเพิ่ม'}</td>
              <td className="min-w-40 p-3">{row.items.map((item, i) => <div key={i} className="mb-1 break-words">
                <p>{item.name} × {item.quantity}</p>
                {row.request_kind === 'replacement' && <>
                  <p className="text-xs text-slate-500">คืน: {item.returnedAssetCode || '—'}</p>
                  <p className="text-xs text-slate-500">ทดแทน: {item.replacementAssetCode || item.originalAssetCode || '—'}</p>
                </>}
              </div>)}</td>
              <td className="whitespace-nowrap p-3"><Link href={`/reports/requisitions/${row.id}`} className="font-medium text-blue-700 hover:underline">ดู / พิมพ์ซ้ำ</Link></td>
            </tr>)}</tbody>
          </table>
          {!history.rows.length && <p className="p-6 text-center text-slate-500">ไม่พบใบขอเบิกตามเงื่อนไข</p>}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-blue-700">← ก่อนหน้า</Link> : <span />}
          <span>หน้า {page} · แสดงสูงสุด 50 ใบต่อหน้า</span>
          {history.hasNext && page < 100000 ? <Link href={pageHref(page + 1)} className="text-blue-700">ถัดไป →</Link> : <span />}
        </div>
      </section>
    </ReportsShell>
  );
}
