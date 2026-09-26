import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import {
  AssetMovementError,
  moveAsset,
} from "@/lib/asset-movements";

export const runtime = "nodejs";

// POST /api/assets/[id]/movements
// Every Owner/Department/Location change is written in one transaction with
// its history row. Admin and IT Staff are checked again against app_accounts.
export async function POST(request, { params }) {
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }

  const { id } = await params;
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const session = await auth();
    const result = await moveAsset(id, body, String(session.user.id));

    return Response.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AssetMovementError) {
      return Response.json(
        { error: error.message },
        { status: error.status || 400 },
      );
    }

    console.error("Asset movement error:", error);

    return Response.json(
      { error: "Unable to save asset movement" },
      { status: 500 },
    );
  }
}
