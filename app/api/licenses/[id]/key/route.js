import { inventoryApi } from '@/lib/inventory-api';
import { getLicenseProductKey } from '@/lib/license-inventory';

export const runtime = 'nodejs';
// Product Keys are available only to Admin and IT Staff, never in list responses.
export async function GET(_request, { params }) {
  return inventoryApi(true, async () => ({ productKey: await getLicenseProductKey((await params).id) }));
}
