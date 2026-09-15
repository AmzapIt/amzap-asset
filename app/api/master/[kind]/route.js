import { query } from "@/lib/db";
import { masterConfig } from "@/lib/master-config";
import { saveMaster } from "@/lib/master-data";
import { requireWrite } from "@/lib/access";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const { kind } = await params;
  if (!Object.hasOwn(masterConfig,kind)) return Response.json({error:"Not found"},{status:404});
  try { return Response.json({rows:(await query(`SELECT * FROM public.${kind} ORDER BY name,id`)).rows}); }
  catch (error) { console.error(error); return Response.json({error:"Unable to load master data"},{status:500}); }
}
export async function POST(request, { params }) {
  const denied = await requireWrite(request, "Admin"); if (denied) return denied;
  const { kind } = await params;
  if (!Object.hasOwn(masterConfig,kind)) return Response.json({error:"Not found"},{status:404});
  try {
    const result=await saveMaster(kind,await request.json());
    return result.rowCount ? Response.json({row:result.rows[0]}) : Response.json({error:"Not found"},{status:404});
  } catch (error) {
    if (error.code) { console.error(error); return Response.json({error:error.code==="23505"?"Name or code already exists":"Unable to save master data"},{status:error.code==="23505"?409:400}); }
    return Response.json({error:error.message},{status:400});
  }
}
