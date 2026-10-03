import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { getCountSession, closeCountSession } from '@/lib/asset-counts';
import { AssetWorkflowError } from '@/lib/asset-scan';
export const runtime = 'nodejs';
export async function GET(_request, { params }) {
  return assetWorkflowApi(false, async () => getCountSession((await params).id));
}
export async function PATCH(request, { params }) {
  return assetWorkflowApi(true, async (account) => {
    if ((await request.json())?.action !== 'close') throw new AssetWorkflowError('คำสั่งไม่ถูกต้อง');
    return { session: await closeCountSession((await params).id, account.id) };
  });
}
