import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { updateRequisition } from '@/lib/asset-requisitions';

export const runtime = 'nodejs';

export async function PATCH(request, { params }) {
  const { id } = await params;
  return assetWorkflowApi(true, async (account) => ({
    requisition: await updateRequisition(id, await request.json(), account.id),
  }));
}
