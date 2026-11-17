import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import { DocumentSettingsError, saveItSignerName } from "@/lib/document-settings";

export const runtime = "nodejs";

// PUT /api/settings/documents { itSignerName } — Admin เท่านั้น
export async function PUT(request) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  try {
    const raw = await request.text();
    if (raw.length > 1000) throw new DocumentSettingsError("ข้อมูลยาวเกินไป");
    const body = JSON.parse(raw);
    const session = await auth();
    const itSignerName = await saveItSignerName(body?.itSignerName, String(session.user.id));
    return Response.json({ success: true, itSignerName });
  } catch (error) {
    if (error instanceof DocumentSettingsError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    console.error("Save document settings failed", error);
    return Response.json({ error: "บันทึกการตั้งค่าไม่สำเร็จ" }, { status: 500 });
  }
}
