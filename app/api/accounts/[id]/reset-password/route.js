import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import {
  AccountError,
  resetAccountPassword,
} from "@/lib/accounts";

export const runtime = "nodejs";

// POST /api/accounts/[id]/reset-password
// The Admin supplies a temporary password and communicates it outside this
// system. The API stores only a bcrypt hash and never returns the password.
export async function POST(request, { params }) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;

  try {
    const session = await auth();
    const { id } = await params;
    await resetAccountPassword(
      id,
      await request.json(),
      String(session.user.id),
    );

    return Response.json({ success: true });
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

    console.error("Reset account password error:", error);
    return Response.json(
      { success: false, error: "Unable to reset password" },
      { status: 500 },
    );
  }
}
