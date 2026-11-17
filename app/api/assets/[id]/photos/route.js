import { requireWrite } from "@/lib/access";
import { auth } from "@/auth";
import { getDbPool, query } from "@/lib/db";
import { shouldMakePrimaryPhoto } from "@/lib/asset-photo-links";
import {
  deleteGoogleDriveFile,
  ensureGoogleDriveLinkSharing,
  uploadAssetPhotoToGoogleDrive,
} from "@/lib/google-drive";
import {
  assetPhotoStorageMode,
  LocalPhotoStorageError,
  removeLocalAssetPhoto,
  saveLocalAssetPhoto,
} from "@/lib/local-asset-photos";
import { deleteSupabaseAssetPhoto, uploadSupabaseAssetPhoto } from "@/lib/supabase-storage";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function validAssetId(value) {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
}

// MIME type จาก Browser สามารถปลอมได้ จึงตรวจ signature ของไฟล์ซ้ำก่อนส่ง
// ข้อมูลออกไปยัง Google Drive
function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(request, { params }) {
  const denied = await requireWrite(request);
  if (denied) return denied;

  const session = await auth();

  const { id } = await params;

  if (!validAssetId(id)) {
    return Response.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload data" }, { status: 400 });
  }

  const photo = formData.get("photo");
  const requestedPrimary = formData.get("makePrimary") !== "false";

  if (!photo || typeof photo.arrayBuffer !== "function") {
    return Response.json({ error: "กรุณาเลือกรูป Asset" }, { status: 400 });
  }
  if (!PHOTO_TYPES.has(photo.type)) {
    return Response.json(
      { error: "รองรับเฉพาะรูป JPG, PNG และ WebP" },
      { status: 400 },
    );
  }
  if (photo.size <= 0 || photo.size > MAX_PHOTO_BYTES) {
    return Response.json(
      { error: "ขนาดรูปต้องไม่เกิน 4 MB" },
      { status: 400 },
    );
  }

  const assetResult = await query(
    "SELECT id, asset_code FROM public.assets WHERE id = $1 LIMIT 1",
    [id],
  );
  const asset = assetResult.rows[0];

  if (!asset) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await photo.arrayBuffer());

  if (!hasValidImageSignature(buffer, photo.type)) {
    return Response.json(
      { error: "เนื้อหาไฟล์ไม่ตรงกับชนิดรูปที่เลือก" },
      { status: 400 },
    );
  }

  const extension = PHOTO_TYPES.get(photo.type);
  const fileName = `${asset.asset_code}-${Date.now()}.${extension}`;
  let driveFile;
  let localFile;
  let supabaseFile;

  try {
    const storageMode = assetPhotoStorageMode();
    if (storageMode === "local") {
      localFile = await saveLocalAssetPhoto({ assetId: id, buffer, mimeType: photo.type });
    } else if (storageMode === "supabase") {
      supabaseFile = await uploadSupabaseAssetPhoto({ buffer, fileName, mimeType: photo.type });
    } else {
      driveFile = await uploadAssetPhotoToGoogleDrive({
        buffer,
        fileName,
        mimeType: photo.type,
      });
      await ensureGoogleDriveLinkSharing(driveFile.id);
    }
    const storedPhoto = localFile
      ? { name: fileName, webViewLink: localFile.storagePath, mimeType: photo.type, size: buffer.length }
      : supabaseFile || driveFile;

    const client = await getDbPool().connect();
    try {
      await client.query("BEGIN");

      // ทำให้การอัปโหลดพร้อมกันของ Asset เดียวกันเรียงคิว เพื่อคงรูปหลัก
      // ไว้เพียงรายการล่าสุด แม้ผู้ใช้สองหน้าจอกด Upload ในเวลาใกล้กัน
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`asset-photo:${id}`],
      );

      const currentPrimary = await client.query(
        `SELECT id FROM public.asset_documents
         WHERE asset_id = $1 AND document_type = 'Asset Photo'
           AND is_primary_photo = true LIMIT 1`,
        [id],
      );
      // The first photo must be primary. Later uploads may be secondary.
      const isPrimary = shouldMakePrimaryPhoto(requestedPrimary, currentPrimary.rows.length > 0);
      if (isPrimary) {
        await client.query(
          `UPDATE public.asset_documents
           SET is_primary_photo = false
           WHERE asset_id = $1 AND document_type = 'Asset Photo'
             AND is_primary_photo = true`,
          [id],
        );
      }
      const documentResult = await client.query(
        `INSERT INTO public.asset_documents (
           asset_id, document_type, file_name, storage_path,
           mime_type, file_size_bytes, is_primary_photo, uploaded_by_account_id
         )
         VALUES ($1, 'Asset Photo', $2, $3, $4, $5, $6, $7)
         RETURNING id::text, file_name, storage_path, mime_type,
                   file_size_bytes, is_primary_photo, created_at`,
        [
          id,
          storedPhoto.name,
          storedPhoto.webViewLink,
          storedPhoto.mimeType,
          storedPhoto.size,
          isPrimary,
          session.user.id,
        ],
      );

      await client.query("COMMIT");

      return Response.json(
        { success: true, photo: documentResult.rows[0] },
        { status: 201 },
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (localFile?.fileName) {
      try {
        await removeLocalAssetPhoto(id, localFile.fileName);
      } catch (cleanupError) {
        console.error("Local Asset photo cleanup failed", cleanupError);
      }
    }
    if (driveFile?.id) {
      try {
        await deleteGoogleDriveFile(driveFile.id);
      } catch (cleanupError) {
        console.error("Google Drive photo cleanup failed", cleanupError);
      }
    }
    if (supabaseFile?.name) {
      try {
        await deleteSupabaseAssetPhoto(supabaseFile.name);
      } catch (cleanupError) {
        console.error("Supabase photo cleanup failed", cleanupError);
      }
    }

    console.error("Asset photo upload failed", error);
    const configurationError =
      error.message === "Google Drive upload is not configured";
    const authorizationExpired =
      error.message === "Google Drive authorization expired";
    const wrongTokenType =
      error.message === "Google Drive access token was used instead of a refresh token";
    const localConfigurationError = error instanceof LocalPhotoStorageError;

    return Response.json(
      {
        error: localConfigurationError
          ? "กรุณาตั้งค่าโฟลเดอร์เก็บรูปบน local server ให้ถูกต้อง"
          : configurationError
          ? "ยังไม่ได้ตั้งค่า Google Drive สำหรับอัปโหลดรูป"
          : wrongTokenType
            ? "ตั้งค่า Access Token ในช่อง Refresh Token กรุณาคัดลอกค่า Refresh token จาก Google OAuth Playground"
          : authorizationExpired
            ? "Refresh Token ของ Google Drive ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิก กรุณาตรวจค่าอีกครั้ง"
            : "ไม่สามารถอัปโหลดรูป Asset ได้",
      },
      { status: configurationError || authorizationExpired || wrongTokenType || localConfigurationError ? 503 : 500 },
    );
  }
}
