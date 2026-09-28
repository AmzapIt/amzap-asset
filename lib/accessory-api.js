import { auth } from "@/auth";
import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";
import { AccessoryError } from "@/lib/accessory-inventory";

export async function accessoryApi(request, write, handler) {
  try {
    if (write) { const denied=await requireWrite(request); if (denied) return denied; }
    const session=await auth();
    if (!session?.user?.id) return Response.json({success:false,error:"กรุณาเข้าสู่ระบบ"},{status:401});
    if (!write) {
      const result=await query("SELECT id FROM public.app_accounts WHERE id=$1 AND is_active=true AND must_change_password=false",[session.user.id]);
      if (!result.rowCount) return Response.json({success:false,error:"บัญชีไม่สามารถเข้าใช้งานได้"},{status:403});
    }
    const result=await handler(session.user.id);
    return Response.json({success:true,...result},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    if (error instanceof AccessoryError) return Response.json({success:false,error:error.message},{status:error.status});
    if (error instanceof SyntaxError) return Response.json({success:false,error:"JSON ไม่ถูกต้อง"},{status:400});
    console.error("Accessory request failed:",error);
    return Response.json({success:false,error:"ไม่สามารถดำเนินการ Accessories ได้ กรุณาลองใหม่"},{status:500});
  }
}
