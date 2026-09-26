import { requireWrite } from "@/lib/access";
import {
  AccountError,
  createAccount,
} from "@/lib/accounts";

export const runtime = "nodejs";

// POST /api/accounts
// Creates a login account. Employee records remain in public."user";
// this endpoint only writes authentication data to public.app_accounts.
export async function POST(request) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;

  try {
    const account = await createAccount(await request.json());

    // createAccount deliberately returns only safe account fields.
    // password and password_hash must never be sent back to the browser.
    return Response.json({ success: true, account }, { status: 201 });
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

    console.error("Create account error:", error);
    return Response.json(
      { success: false, error: "Unable to create account" },
      { status: 500 },
    );
  }
}
