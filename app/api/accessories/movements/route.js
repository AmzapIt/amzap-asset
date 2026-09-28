import { accessoryApi } from "@/lib/accessory-api";
import { accessoryMovementFilters, getAccessoryMovements } from "@/lib/accessory-read";
export const runtime="nodejs";
export async function GET(request) {
  return accessoryApi(request,false,()=>getAccessoryMovements(accessoryMovementFilters(request.url)));
}
