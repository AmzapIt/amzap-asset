import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { getAssetHistory } from '@/lib/asset-history';
export const runtime = 'nodejs';
export async function GET(request, { params }) {
  return assetWorkflowApi(false, async () => getAssetHistory((await params).id, new URL(request.url).searchParams.get('cursor')));
}
