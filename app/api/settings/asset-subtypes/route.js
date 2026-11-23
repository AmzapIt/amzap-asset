import { query } from "@/lib/db";
import { AssetWorkflowError } from "@/lib/asset-scan";
import { assetWorkflowApi } from "@/lib/asset-workflow-api";
import { listAssetSubtypes, parseSubtypeInput, saveAssetSubtype } from "@/lib/asset-subtypes";

export const runtime = "nodejs";

const db = { query };

// GET /api/settings/asset-subtypes — ผู้ที่ล็อกอินแล้ว ใช้ในฟอร์ม Asset และหน้า Settings
export async function GET() {
  return assetWorkflowApi(false, async () => ({ subtypes: await listAssetSubtypes(db) }));
}

async function save(request) {
  return assetWorkflowApi(true, async (account) => {
    if (account.role !== "Admin") throw new AssetWorkflowError("เฉพาะ Admin เท่านั้น", 403);
    const raw = await request.text();
    if (raw.length > 1000) throw new AssetWorkflowError("ข้อมูลยาวเกินไป");
    const id = await saveAssetSubtype(db, parseSubtypeInput(JSON.parse(raw)));
    return { id, subtypes: await listAssetSubtypes(db) };
  });
}

// POST เพิ่ม / PUT แก้ไข (Admin เท่านั้น)
export async function POST(request) {
  return save(request);
}

export async function PUT(request) {
  return save(request);
}
