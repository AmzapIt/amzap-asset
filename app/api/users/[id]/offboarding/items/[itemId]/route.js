import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import { dismissLegacyOffboardingItem, OffboardingError } from "@/lib/offboarding";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const denied = await requireWrite(request);
  if (denied) return denied;
  try {
    const { id, itemId } = await params;
    const body = await request.json();
    const session = await auth();
    const item = await dismissLegacyOffboardingItem(
      id,
      itemId,
      body?.reason,
      String(session.user.id),
    );
    return Response.json({ success: true, item });
  } catch (error) {
    if (error instanceof OffboardingError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.error("Legacy offboarding item error:", error);
    return Response.json({ error: "ไม่สามารถบันทึกผลตรวจสอบได้" }, { status: 500 });
  }
}
