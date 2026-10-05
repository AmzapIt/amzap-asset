import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getRequisition, getRequisitionOptions } from '@/lib/asset-requisitions';
import { AssetWorkflowError } from '@/lib/asset-scan';
import ReportsShell, { ReportLoadError } from '../../../ReportsShell';
import RequisitionForm from '../../RequisitionForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function EditRequisitionPage({ params }) {
  const account = await workflowPageAccount();
  if (!account.canWrite) redirect('/reports/requisitions');
  const { id } = await params;
  let request, options;
  try {
    [request, options] = await Promise.all([getRequisition(id), getRequisitionOptions()]);
  } catch (error) {
    if (error instanceof AssetWorkflowError && [400, 404].includes(error.status)) notFound();
    console.error('Requisition edit page load failed', error);
    return <ReportLoadError retryHref={`/reports/requisitions/${encodeURIComponent(id)}/edit`} />;
  }
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return (
    <ReportsShell view="requisitions" canViewOperational title="แก้ไขใบขอเบิก / เปลี่ยนอุปกรณ์"
      description="แก้ไขข้อมูลเอกสารได้ โดยระบบเก็บประวัติฉบับก่อนหน้า และไม่เปลี่ยนสถานะ Asset จริง">
      <Link href={`/reports/requisitions/${id}`} className="text-blue-700 hover:underline">← กลับไปดูเอกสาร</Link>
      <RequisitionForm {...options} initialUserId={request.request_payload?.userId || ''}
        initialRequest={request} today={today} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">ประวัติการแก้ไข</h2>
        {!request.revisions.length
          ? <p className="mt-2 text-sm text-slate-500">ยังไม่มีประวัติการแก้ไข</p>
          : <ol className="mt-3 space-y-3">
            {request.revisions.map((revision) => (
              <li key={revision.revision_no} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">ฉบับก่อนแก้ไข #{revision.revision_no}</p>
                <p className="text-slate-600">{revision.modified_by_name} · {new Date(revision.modified_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
                <p className="mt-1">ประเภท: {revision.request_kind === 'replacement' ? 'เปลี่ยนทดแทน / คืน' : 'ขอเพิ่ม'} · วันที่ขอ {revision.requested_date}</p>
                <p>เหตุผล: {revision.reason} · เจ้าหน้าที่ IT: {revision.it_staff_name}</p>
                {revision.items.map((item, index) => (
                  <p key={index} className="text-slate-600">
                    {item.name} × {item.quantity}
                    {item.returnedAssetCode && ` · คืน ${item.returnedAssetCode}`}
                    {(item.replacementAssetCode || item.originalAssetCode) && ` · ทดแทน ${item.replacementAssetCode || item.originalAssetCode}`}
                  </p>
                ))}
              </li>
            ))}
          </ol>}
      </section>
    </ReportsShell>
  );
}
