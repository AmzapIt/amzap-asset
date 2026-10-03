import { workflowPageAccount } from '@/lib/asset-workflow-api';
import ScanAsset from './ScanAsset';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function ScanPage() {
  const account = await workflowPageAccount();
  return <ScanAsset canWrite={account.canWrite} />;
}
