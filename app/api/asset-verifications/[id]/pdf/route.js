import { workflowAccount } from '@/lib/asset-workflow-api';
import { AssetWorkflowError } from '@/lib/asset-scan';
import { getVerificationPrintBatch, prepareVerificationPrintBatch } from '@/lib/asset-verifications';
import { assetVerificationBatchPdf } from '@/lib/export-files';
import { getItSignerName } from '@/lib/document-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pdfResponse(round, buffer) {
  const roundLabel = `${round.year}-${String(round.round_no).padStart(2, '0')}`;
  return new Response(new Uint8Array(buffer), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="AMZAP-AV-${roundLabel}-ALL.pdf"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

function pdfError(error) {
  if (error instanceof AssetWorkflowError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 });
  }
  console.error('Asset verification batch PDF failed', error);
  return Response.json({ error: 'ไม่สามารถสร้างไฟล์รวมใบตรวจได้ กรุณาลองใหม่' }, { status: 503 });
}

export async function POST(request, { params }) {
  try {
    const account = await workflowAccount();
    if (!account.canWrite) throw new AssetWorkflowError('บัญชีนี้ดูข้อมูลได้อย่างเดียว', 403);
    const { round, records } = await prepareVerificationPrintBatch(
      (await params).id, await request.json(), account.id);
    return pdfResponse(round, await assetVerificationBatchPdf(records, await getItSignerName()));
  } catch (error) { return pdfError(error); }
}

export async function GET(_request, { params }) {
  try {
    await workflowAccount();
    const { round, records } = await getVerificationPrintBatch((await params).id);
    const buffer = await assetVerificationBatchPdf(records, await getItSignerName());
    return pdfResponse(round, buffer);
  } catch (error) { return pdfError(error); }
}
