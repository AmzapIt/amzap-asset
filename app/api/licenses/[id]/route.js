import { inventoryApi } from '@/lib/inventory-api';
import { updateLicense } from '@/lib/license-inventory';

export const runtime = 'nodejs';
export async function PATCH(request, { params }) {
  return inventoryApi(true, async account => ({ result: await updateLicense((await params).id, await request.json(), account.id) }));
}
