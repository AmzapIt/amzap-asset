import { inventoryApi } from '@/lib/inventory-api';
import { createLicense, getLicenseInventory } from '@/lib/license-inventory';

export const runtime = 'nodejs';
export async function GET() {
  return inventoryApi(false, account => getLicenseInventory(undefined, { includePrivate: account.canWrite }));
}
export async function POST(request) {
  return inventoryApi(true, async account => ({ result: await createLicense(await request.json(), account.id) }));
}
