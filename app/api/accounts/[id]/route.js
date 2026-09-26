import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import {
  AccountError,
  updateAccount,
} from "@/lib/accounts";

export const runtime = "nodejs";

// PATCH /api/accounts/[id]
// Admin may change account profile, role, employee link, and active status.
// Password changes use separate endpoints so password data cannot be mixed
// accidentally into ordinary profile updates.
export async function PATCH(request, { params }) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;

  try {
    const session = await auth();
    const { id } = await params;
    const account = await updateAccount(
      id,
      await request.json(),
      String(session.user.id),
    );

    return Response.json({ success: true, account });
  } catch (error) {
    if (error instanceof AccountError) {
      return Response.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { success: false, error: "Invalid JSON request" },
        { status: 400 },
      );
    }

    console.error("Update account error:", error);
    return Response.json(
      { success: false, error: "Unable to update account" },
      { status: 500 },
    );
  }
}
