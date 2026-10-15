import { query } from "@/lib/db";
import { AssetWorkflowError } from "@/lib/asset-scan";
import { workflowAccount } from "@/lib/asset-workflow-api";
import {
  localPhotoUrl,
  LocalPhotoStorageError,
  readLocalAssetPhoto,
} from "@/lib/local-asset-photos";

export const runtime = "nodejs";

const CONTENT_TYPES = new Map([
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export async function GET(_request, { params }) {
  try {
    await workflowAccount();
    const { id, fileName } = await params;
    let storagePath;
    try {
      storagePath = localPhotoUrl(id, fileName);
    } catch (error) {
      if (error instanceof LocalPhotoStorageError) {
        return new Response(null, { status: 404 });
      }
      throw error;
    }

    const document = (await query(
      `SELECT id FROM public.asset_documents
       WHERE asset_id = $1 AND document_type = 'Asset Photo'
         AND storage_path = $2 LIMIT 1`,
      [id, storagePath],
    )).rows[0];
    if (!document) return new Response(null, { status: 404 });

    const buffer = await readLocalAssetPhoto(id, fileName);
    const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES.get(extension),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AssetWorkflowError) {
      return new Response(null, { status: error.status });
    }
    if (error?.code === "ENOENT") return new Response(null, { status: 404 });
    if (error instanceof LocalPhotoStorageError) {
      return Response.json({ error: "Local photo storage is not configured on this server" }, { status: 503 });
    }
    console.error("Read local Asset photo failed", error);
    return new Response(null, { status: 500 });
  }
}
