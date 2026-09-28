import { accessoryApi } from "@/lib/accessory-api";
import { getAccessoryInventory } from "@/lib/accessory-read";
import { receiveAccessories } from "@/lib/accessory-inventory";

export const runtime="nodejs";
export async function GET(request) { return accessoryApi(request,false,()=>getAccessoryInventory()); }
export async function POST(request) {
  return accessoryApi(request,true,async(actor)=>({result:await receiveAccessories(await request.json(),actor)}));
}
