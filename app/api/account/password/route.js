import { auth, unstable_update } from "@/auth";
import {
  AccountError,
  changeOwnPassword,
} from "@/lib/accounts";

export const runtime = "nodejs";

// POST /api/account/password
// Every active account, including Read-only, may change its own password.
// This intentionally does not use requireWrite(), which protects business
// data mutations and would reject Read-only users.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    await changeOwnPassword(
      String(session.user.id),
      await request.json(),
    );

    // Refresh the signed JWT from database state. The jwt callback ignores
    // client values, so callers cannot clear the restriction themselves.
    await unstable_update({});

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

    console.error("Change password error:", error);
    return Response.json(
      { success: false, error: "Unable to change password" },
      { status: 500 },
    );
  }
}
