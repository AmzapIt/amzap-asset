import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { createRequisition } from '@/lib/asset-requisitions';

export const runtime = 'nodejs';

export async function POST(request) {
  return assetWorkflowApi(true, async (account) => ({
    requisition: await createRequisition(await request.json(), account.id),
  }));
}
