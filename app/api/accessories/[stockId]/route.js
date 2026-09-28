import { accessoryApi } from "@/lib/accessory-api";
import { editStockItem } from "@/lib/accessory-inventory";
export const runtime="nodejs";
export async function PATCH(request,{params}) {
  return accessoryApi(request,true,async(actor)=>({result:await editStockItem((await params).stockId,await request.json(),actor)}));
}
