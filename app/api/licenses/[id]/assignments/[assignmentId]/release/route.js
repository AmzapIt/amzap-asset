import { inventoryApi } from '@/lib/inventory-api';
import { releaseLicense } from '@/lib/license-inventory';

export const runtime = 'nodejs';
export async function POST(request, { params }) {
  return inventoryApi(true, async account => {
    const { id, assignmentId } = await params;
    return { result: await releaseLicense(id, assignmentId, await request.json(), account.id) };
  });
}
