import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { recordCountCheck } from '@/lib/asset-counts';
export const runtime = 'nodejs';
export async function POST(request, { params }) {
  return assetWorkflowApi(true, async (account) => {
    const { id, itemId } = await params;
    return { item: await recordCountCheck(id, itemId, await request.json(), account.id) };
  });
}
