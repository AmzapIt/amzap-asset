import { inventoryApi } from '@/lib/inventory-api';
import { updateConsumable } from '@/lib/consumable-inventory';

export const runtime = 'nodejs';
export async function PATCH(request, { params }) {
  return inventoryApi(true, async account => ({ result: await updateConsumable((await params).id, await request.json(), account.id) }));
}
