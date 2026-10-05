import { workflowAccount } from '@/lib/asset-workflow-api';
import { getRequisition } from '@/lib/asset-requisitions';
import { AssetWorkflowError } from '@/lib/asset-scan';
import { requisitionPdf } from '@/lib/export-files';
import { sanitizeFilenamePart } from '@/lib/export-filename';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await workflowAccount();
    const { id } = await params;
    const requisition = await getRequisition(id);
    const buffer = await requisitionPdf(requisition);
    const number = `REQ-${id.padStart(6, '0')}`;
    const filename = `AMZAP-${sanitizeFilenamePart(requisition.employee_snapshot.full_name)}-${number}.pdf`;
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="AMZAP-${number}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof AssetWorkflowError) {
      return Response.json({ success: false, error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('Requisition PDF failed', error);
    return Response.json({ success: false, error: 'ไม่สามารถสร้างเอกสารได้ กรุณาลองใหม่' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
