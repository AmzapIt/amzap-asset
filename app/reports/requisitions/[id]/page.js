import Link from 'next/link';
import { notFound } from 'next/navigation';
import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getRequisition } from '@/lib/asset-requisitions';
import { AssetWorkflowError } from '@/lib/asset-scan';
import { ReportLoadError } from '../../ReportsShell';
import PrintButton from './PrintButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'AMZAP - ใบขอเบิก / เปลี่ยนอุปกรณ์' };

export default async function RequisitionDocumentPage({ params }) {
  const account = await workflowPageAccount();
  const { id } = await params;
  let request;
  try { request = await getRequisition(id); }
  catch (error) {
    if (error instanceof AssetWorkflowError && [400, 404].includes(error.status)) notFound();
    console.error('Requisition document load failed', error);
    return <ReportLoadError retryHref={`/reports/requisitions/${encodeURIComponent(id)}`} />;
  }
  const number = `REQ-${request.id.padStart(6, '0')}`;
  const pdfUrl = `/api/asset-requisitions/${request.id}/pdf`;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/reports/requisitions#history" className="text-blue-700 hover:underline">← ประวัติใบขอเบิก</Link>
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-xl font-bold">ใบขอเบิก / เปลี่ยนทดแทนและคืนอุปกรณ์ {number}</h1>
            <p className="mt-2 text-sm text-slate-600">เอกสาร PDF ตามแบบ AMZAP พร้อมช่องเซ็นผู้ขอ / เจ้าหน้าที่ IT / ผู้อนุมัติ</p>
          </div>
          {account.canWrite && <Link href={`/reports/requisitions/${request.id}/edit`}
            className="inline-flex rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
            แก้ไขเอกสาร
          </Link>}
          <PrintButton pdfUrl={pdfUrl} />
          <p className="text-sm text-slate-600">เปิด PDF แล้วเลือกพิมพ์บนกระดาษ A4 แนวตั้ง สเกล 100% หากมือถือไม่แสดงตัวอย่าง ให้เปิดหรือดาวน์โหลด PDF จากปุ่มด้านบน</p>
          <p className="text-sm text-amber-800">เป็นเอกสารคำขอเท่านั้น การเปิดหรือพิมพ์ซ้ำไม่สร้างคำขอใหม่ ไม่เปลี่ยนเจ้าของ และไม่ตัดคลัง</p>
        </section>
        <iframe src={pdfUrl} title={`ตัวอย่างเอกสาร ${number}`}
          className="hidden h-[1100px] w-full rounded-xl border border-slate-200 bg-white md:block" />
        {request.revisions.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">แก้ไขแล้ว {request.revisions.length} ครั้ง</h2>
          <p className="mt-1 text-sm text-slate-600">
            แก้ไขล่าสุด {new Date(request.revisions[0].modified_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
            {' '}โดย {request.revisions[0].modified_by_name}
          </p>
        </section>}
      </div>
    </main>
  );
}
