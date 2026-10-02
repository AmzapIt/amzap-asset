import { auth } from "@/auth";
import { requireWrite } from "@/lib/access";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  const denied = await requireWrite(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const ids = body?.assetIds;
  const requestId = body?.requestId;
  if (body?.source != null && !["print", "existing"].includes(body.source)) {
    return Response.json({ error: "ประเภทการบันทึกไม่ถูกต้อง" }, { status: 400 });
  }
  const source = body?.source === "existing" ? "existing" : "print";
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 ||
      ids.some((id) => typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) ||
      new Set(ids).size !== ids.length ||
      typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return Response.json({ error: "กรุณาเลือก Asset ที่ต้องการบันทึก (สูงสุด 100 รายการ)" }, { status: 400 });
  }

  const sortedIds = [...ids].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const session = await auth();
  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      `INSERT INTO public.asset_label_print_batches (id, asset_ids, source, printed_by_account_id)
       VALUES ($1, $2::bigint[], $3, $4)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [requestId, sortedIds, source, session.user.id],
    );

    if (batch.rowCount === 0) {
      const existing = (await client.query(
        `SELECT asset_ids::text[] AS asset_ids, source,
                printed_by_account_id::text AS actor_id
           FROM public.asset_label_print_batches WHERE id=$1`,
        [requestId],
      )).rows[0];
      if (existing?.actor_id !== String(session.user.id) || existing?.source !== source ||
          JSON.stringify(existing?.asset_ids) !== JSON.stringify(sortedIds)) {
        await client.query("ROLLBACK");
        return Response.json({ error: "หมายเลขคำขอนี้ถูกใช้กับการพิมพ์รายการอื่นแล้ว" }, { status: 409 });
      }
    } else {
      const assetRows = (await client.query(
        `SELECT id::text AS id, asset_code
           FROM public.assets
          WHERE id=ANY($1::bigint[])
          ORDER BY id FOR UPDATE`,
        [sortedIds],
      )).rows;
      if (assetRows.length !== sortedIds.length || assetRows.some((asset) => !asset.asset_code)) {
        await client.query("ROLLBACK");
        return Response.json({ error: "ไม่พบ Asset บางรายการ กรุณาโหลดหน้าใหม่" }, { status: 409 });
      }
      if (source === "existing") {
        const previous = await client.query(
          `SELECT asset_id FROM public.asset_label_prints
            WHERE asset_id=ANY($1::bigint[]) LIMIT 1`,
          [sortedIds],
        );
        if (previous.rowCount > 0) {
          await client.query("ROLLBACK");
          return Response.json({ error: "Asset บางรายการมีประวัติพิมพ์แล้ว กรุณาโหลดหน้าใหม่" }, { status: 409 });
        }
      }
      await client.query(
        `INSERT INTO public.asset_label_prints (batch_id, asset_id, asset_code)
         SELECT $1, asset.id, asset.asset_code
           FROM public.assets asset
          WHERE asset.id=ANY($2::bigint[])`,
        [requestId, sortedIds],
      );
    }

    const result = await client.query(
      `SELECT p.asset_id::text AS id, COUNT(*)::int AS print_count,
              BOOL_OR(b.source='existing') AS has_existing_label,
              to_char(MAX(p.printed_at) AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_printed_at
         FROM public.asset_label_prints p
         JOIN public.asset_label_print_batches b ON b.id=p.batch_id
        WHERE p.asset_id=ANY($1::bigint[])
        GROUP BY p.asset_id`,
      [sortedIds],
    );
    await client.query("COMMIT");
    return Response.json({ success: true, assets: result.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record Asset label print error:", error);
    return Response.json({ error: "บันทึกประวัติการพิมพ์ไม่สำเร็จ" }, { status: 500 });
  } finally {
    client.release();
  }
}
