import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { listCountSessions, createCountSession } from '@/lib/asset-counts';
export const runtime = 'nodejs';
export async function GET() {
  return assetWorkflowApi(false, async () => ({ sessions: await listCountSessions() }));
}
export async function POST(request) {
  return assetWorkflowApi(true, async (account) => ({ session: await createCountSession(await request.json(), account.id) }));
}
