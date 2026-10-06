import { inventoryApi } from '@/lib/inventory-api';
import { createConsumable, getConsumableInventory } from '@/lib/consumable-inventory';

export const runtime = 'nodejs';
export async function GET() {
  return inventoryApi(false, () => getConsumableInventory());
}
export async function POST(request) {
  return inventoryApi(true, async account => ({ result: await createConsumable(await request.json(), account.id) }));
}
