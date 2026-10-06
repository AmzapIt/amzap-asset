import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getConsumableInventory } from '@/lib/consumable-inventory';
import ConsumableManager from './ConsumableManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ConsumablesPage() {
  const account = await workflowPageAccount();
  let inventory;
  try {
    inventory = await getConsumableInventory();
  } catch (error) {
    console.error('Load consumables failed:', error);
  }
  if (!inventory) return <main className="p-6"><h1 className="text-2xl font-bold">Consumables</h1>
      <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">ยังโหลดข้อมูล Consumables ไม่ได้ กรุณาตรวจ migration 027 และการเชื่อมต่อฐานข้อมูล</p>
    </main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
    <div className="mx-auto max-w-[1600px]"><ConsumableManager initialInventory={inventory} canWrite={account.canWrite} /></div>
  </main>;
}
