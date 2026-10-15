import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { createVerificationRound, listVerificationRounds } from '@/lib/asset-verifications';

export const runtime = 'nodejs';

export async function GET() {
  return assetWorkflowApi(false, async () => ({ rounds: await listVerificationRounds() }));
}

export async function POST(request) {
  return assetWorkflowApi(true, async (account) => ({
    round: await createVerificationRound(await request.json(), account.id),
  }));
}
