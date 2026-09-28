import { accessoryApi } from "@/lib/accessory-api";
import { getEmployeeAccessories } from "@/lib/accessory-read";
import { issueAccessories } from "@/lib/accessory-inventory";
export const runtime="nodejs";
export async function GET(request,{params}) {
  return accessoryApi(request,false,async()=>getEmployeeAccessories((await params).id));
}
export async function POST(request,{params}) {
  return accessoryApi(request,true,async(actor)=>({result:await issueAccessories((await params).id,await request.json(),actor)}));
}