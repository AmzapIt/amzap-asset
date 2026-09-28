import { accessoryApi } from "@/lib/accessory-api";
import { changeAccessoryHolding } from "@/lib/accessory-inventory";
export const runtime="nodejs";
export async function POST(request,{params}) {
  return accessoryApi(request,true,async(actor)=>{
    const {id,accessoryId}=await params;
    return {result:await changeAccessoryHolding(id,accessoryId,"transfer",await request.json(),actor)};
  });
}
