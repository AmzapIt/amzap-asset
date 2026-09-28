import { accessoryApi } from "@/lib/accessory-api";
import { disposeStock } from "@/lib/accessory-inventory";
export const runtime="nodejs";
export async function POST(request,{params}) {
  return accessoryApi(request,true,async(actor)=>({result:await disposeStock((await params).stockId,await request.json(),actor)}));
}
