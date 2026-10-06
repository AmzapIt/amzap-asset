import { inventoryApi } from '@/lib/inventory-api';
import { moveConsumable } from '@/lib/consumable-inventory';

export const runtime = 'nodejs';
export async function POST(request, { params }) {
  return inventoryApi(true, async account => ({ result: await moveConsumable((await params).id, await request.json(), account.id) }));
}
