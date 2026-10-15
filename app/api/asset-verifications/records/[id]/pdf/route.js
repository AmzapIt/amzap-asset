import { workflowAccount } from '@/lib/asset-workflow-api';
import { AssetWorkflowError } from '@/lib/asset-scan';
import { getVerificationRecord } from '@/lib/asset-verifications';
import { assetVerificationPdf } from '@/lib/export-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    await workflowAccount();
    const record = await getVerificationRecord((await params).id);
    const buffer = await assetVerificationPdf(record);
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="AMZAP-${record.document_no}.pdf"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof AssetWorkflowError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Asset verification PDF failed', error);
    return Response.json({ error: 'ไม่สามารถสร้างใบตรวจได้ กรุณาลองใหม่' }, { status: 503 });
  }
}
