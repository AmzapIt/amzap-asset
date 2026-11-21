import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import { getMachineSpecsEnabled, saveMachineSpecsEnabled } from "@/lib/machine-specs-settings";

export const runtime = "nodejs";

// GET /api/settings/machine-specs — ผู้ที่ล็อกอินแล้ว ใช้ในหน้าแก้ไข Asset
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    return Response.json({ success: true, enabled: await getMachineSpecsEnabled() });
  } catch (error) {
    console.error("Read machine specs setting failed", error);
    return Response.json({ error: "อ่านการตั้งค่าไม่สำเร็จ" }, { status: 500 });
  }
}

// PUT /api/settings/machine-specs { enabled } — Admin เท่านั้น
export async function PUT(request) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  try {
    const raw = await request.text();
    if (raw.length > 200) return Response.json({ error: "ข้อมูลยาวเกินไป" }, { status: 400 });
    const body = JSON.parse(raw);
    if (typeof body?.enabled !== "boolean") {
      return Response.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const session = await auth();
    const enabled = await saveMachineSpecsEnabled(body.enabled, String(session.user.id));
    return Response.json({ success: true, enabled });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    if (error?.code === "42P01") {
      return Response.json({ error: "ยังไม่ได้เตรียมฐานข้อมูล กรุณารัน migrations/031-app-settings.sql ก่อน" }, { status: 503 });
    }
    console.error("Save machine specs setting failed", error);
    return Response.json({ error: "บันทึกการตั้งค่าไม่สำเร็จ" }, { status: 500 });
  }
}
