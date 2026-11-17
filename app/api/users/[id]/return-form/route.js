import { requireWrite } from "@/lib/access";
import { getCurrentAccessories, getRecipient, getReportAssets } from "@/lib/asset-report";
import { returnFormPdf } from "@/lib/export-files";
import { returnFormFilename } from "@/lib/export-filename";
import { getItSignerName } from "@/lib/document-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (v) => typeof v === "string" && /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n;

// GET /api/users/:id/return-form
// ใบคืนทรัพย์สินแบบกรอกมือ จากของที่พนักงาน Active ถืออยู่ตอนนี้ (อ่านอย่างเดียว)
export async function GET(request, { params }) {
  const denied = await requireWrite(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!validId(id)) return Response.json({ error: "Invalid ID" }, { status: 400 });
    const employee = await getRecipient(id);
    if (!employee) return Response.json({ error: "ไม่พบพนักงาน" }, { status: 404 });
    if (!employee.is_active) return Response.json({ error: "พนักงานคนนี้ปิดสถานะแล้ว" }, { status: 400 });
    const [assets, accessories, itSignerName] = await Promise.all([getReportAssets(), getCurrentAccessories(id), getItSignerName()]);
    const held = assets.filter((asset) => asset.current_holder_id === id);
    const buffer = await returnFormPdf(employee, held, accessories, itSignerName);
    const filename = returnFormFilename(employee);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="AMZAP-return.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Return form failed", error);
    return Response.json({ error: "ไม่สามารถสร้างใบคืนทรัพย์สินได้" }, { status: 500 });
  }
}
