import { requireWrite } from "@/lib/access";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

const validId = (value) => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);

export async function DELETE(request, { params }) {
  const denied = await requireWrite(request);
  if (denied) return denied;

  const { id, photoId } = await params;
  if (!validId(id) || !validId(photoId)) {
    return Response.json({ error: "รหัส Asset หรือรูปไม่ถูกต้อง" }, { status: 400 });
  }

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    // Serialize with uploads and other removals for this Asset.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`asset-photo:${id}`]);
    const removed = await client.query(
      `DELETE FROM public.asset_documents
       WHERE id = $1 AND asset_id = $2 AND document_type = 'Asset Photo'
       RETURNING id`,
      [photoId, id],
    );
    if (!removed.rows.length) {
      await client.query("ROLLBACK");
      return Response.json({ error: "ไม่พบลิงก์รูปนี้ของ Asset" }, { status: 404 });
    }

    // If the primary was removed (or legacy data had none), promote the newest remaining photo.
    await client.query(
      `UPDATE public.asset_documents SET is_primary_photo = true
       WHERE id = (
         SELECT id FROM public.asset_documents
         WHERE asset_id = $1 AND document_type = 'Asset Photo'
           AND NOT EXISTS (
             SELECT 1 FROM public.asset_documents
             WHERE asset_id = $1 AND document_type = 'Asset Photo'
               AND is_primary_photo = true
           )
         ORDER BY id DESC LIMIT 1
       )`,
      [id],
    );
    await client.query("COMMIT");
    // Only the database link is removed. Drive/local files are intentionally retained.
    return Response.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Remove Asset photo link failed", error);
    return Response.json({ error: "ลบลิงก์รูปไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  } finally {
    client.release();
  }
}
