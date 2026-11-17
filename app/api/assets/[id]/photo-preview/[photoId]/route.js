import sharp from "sharp";
import { query } from "@/lib/db";
import { AssetWorkflowError, workflowId } from "@/lib/asset-scan";
import { workflowAccount } from "@/lib/asset-workflow-api";
import { downloadGoogleDrivePhoto } from "@/lib/google-drive";
import {
  localPhotoUrl,
  LocalPhotoStorageError,
  readLocalAssetPhoto,
} from "@/lib/local-asset-photos";
import { downloadSupabasePhoto, isSupabaseAssetPhotoUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    await workflowAccount();
    const parameters = await params;
    const assetId = workflowId(parameters.id);
    const photoId = workflowId(parameters.photoId);
    const photo = (await query(
      `SELECT storage_path FROM public.asset_documents
       WHERE id=$1 AND asset_id=$2 AND document_type='Asset Photo' LIMIT 1`,
      [photoId, assetId],
    )).rows[0];
    if (!photo) return new Response(null, { status: 404 });

    let original;
    if (photo.storage_path?.startsWith(`/api/assets/${assetId}/photos/`)) {
      const fileName = photo.storage_path.split("/").at(-1);
      if (localPhotoUrl(assetId, fileName) !== photo.storage_path) {
        return new Response(null, { status: 404 });
      }
      original = await readLocalAssetPhoto(assetId, fileName);
    } else if (isSupabaseAssetPhotoUrl(photo.storage_path)) {
      original = await downloadSupabasePhoto(photo.storage_path);
    } else {
      original = await downloadGoogleDrivePhoto(photo.storage_path);
    }

    const preview = await sharp(original, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(384, 384, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();

    return new Response(new Uint8Array(preview), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(preview.length),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AssetWorkflowError) {
      return new Response(null, { status: error.status });
    }
    if (error?.code === "ENOENT") return new Response(null, { status: 404 });
    if (error instanceof LocalPhotoStorageError) {
      return new Response(null, { status: 503 });
    }
    console.error("Asset photo preview failed", error);
    return new Response(null, { status: 502 });
  }
}
