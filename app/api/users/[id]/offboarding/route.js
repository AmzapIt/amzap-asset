import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import {
  closeOffboarding,
  OffboardingError,
  startOffboarding,
} from "@/lib/offboarding";

export const runtime = "nodejs";

function respond(error) {
  if (error instanceof OffboardingError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Employee offboarding error:", error);
  return Response.json({ error: "ไม่สามารถบันทึกขั้นตอนลาออกได้" }, { status: 500 });
}

export async function POST(request, { params }) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  try {
    const { id } = await params;
    const session = await auth();
    const offboarding = await startOffboarding(id, String(session.user.id));
    return Response.json({ success: true, offboarding });
  } catch (error) {
    return respond(error);
  }
}

export async function PATCH(request, { params }) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  try {
    const { id } = await params;
    const session = await auth();
    const offboarding = await closeOffboarding(id, String(session.user.id));
    return Response.json({ success: true, offboarding });
  } catch (error) {
    return respond(error);
  }
}
