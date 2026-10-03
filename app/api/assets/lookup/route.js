import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { lookupAsset } from '@/lib/asset-scan';
export const runtime = 'nodejs';
export async function GET(request) {
  return assetWorkflowApi(false, async () => ({ asset: await lookupAsset(new URL(request.url).searchParams.get('code')) }));
}
