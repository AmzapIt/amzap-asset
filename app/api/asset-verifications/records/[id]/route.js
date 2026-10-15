import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { getVerificationRecord, updateVerificationRecord } from '@/lib/asset-verifications';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  return assetWorkflowApi(false, async () => ({ record: await getVerificationRecord((await params).id) }));
}

export async function PATCH(request, { params }) {
  return assetWorkflowApi(true, async (account) => ({
    record: await updateVerificationRecord((await params).id, await request.json(), account.id),
  }));
}
