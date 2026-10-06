import { inventoryApi } from '@/lib/inventory-api';
import { assignLicense } from '@/lib/license-inventory';

export const runtime = 'nodejs';
export async function POST(request, { params }) {
  return inventoryApi(true, async account => ({ result: await assignLicense((await params).id, await request.json(), account.id) }));
}
