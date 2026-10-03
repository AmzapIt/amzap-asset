import { notFound } from 'next/navigation';
import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { countLookups } from '@/lib/asset-counts';
import CountSession from './CountSession';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function CountSessionPage({ params }) {
  const account = await workflowPageAccount();
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) notFound();
  const { locations, users } = await countLookups();
  return <CountSession id={id} canWrite={account.canWrite} locations={locations} users={users} />;
}
