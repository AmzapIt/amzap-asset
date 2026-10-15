import { assetWorkflowApi } from '@/lib/asset-workflow-api';
import { deleteVerificationRound, getVerificationRound, issueVerification } from '@/lib/asset-verifications';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  return assetWorkflowApi(false, async () => ({ data: await getVerificationRound((await params).id) }));
}

export async function POST(request, { params }) {
  return assetWorkflowApi(true, async (account) => {
    const { userId } = await request.json();
    return { record: await issueVerification((await params).id, userId, account.id) };
  });
}

export async function DELETE(request, { params }) {
  return assetWorkflowApi(true, async () => ({
    result: await deleteVerificationRound((await params).id, await request.json()),
  }));
}
