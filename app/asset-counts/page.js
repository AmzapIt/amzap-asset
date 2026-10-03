import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { countLookups } from '@/lib/asset-counts';
import CountSessions from './CountSessions';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AssetCountsPage() {
  const account = await workflowPageAccount();
  const { locations,types } = await countLookups();
  return <CountSessions canWrite={account.canWrite} locations={locations} types={types} />;
}
