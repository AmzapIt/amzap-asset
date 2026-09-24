import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

export const runtime = "nodejs";

function validId(id) {
  const value = String(id);
  return (
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

// คืน Accessory ทั้งรายการโดยตั้ง returned_date ได้ครั้งเดียว; ยังไม่รองรับ Partial Return
// user_id ป้องกันการคืนรายการของพนักงานอื่น และวันที่ต้องอยู่ระหว่างวันเบิกกับ
// วันที่ปัจจุบันตามเวลา Asia/Bangkok
export async function PATCH(request, { params }) {
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }

  try {
    const { id, accessoryId } = await params;

    if (!validId(id) || !validId(accessoryId)) {
      return Response.json(
        { success: false, error: "ID ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { success: false, error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const returnedDate =
      typeof body.returned_date === "string" && body.returned_date.trim()
        ? body.returned_date.trim()
        : null;

    if (returnedDate && !validDate(returnedDate)) {
      return Response.json(
        { success: false, error: "Returned Date ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const result = await query(
      `
        UPDATE public.employee_accessories
        SET
          returned_date = COALESCE(
            $1::date,
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
          ),
          updated_at = now()
        WHERE id = $2
          AND user_id = $3
          AND returned_date IS NULL
          AND COALESCE(
            $1::date,
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
          ) >= issued_date
          AND COALESCE(
            $1::date,
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
          ) <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
        RETURNING *
      `,
      [returnedDate, accessoryId, id],
    );

    if (!result.rowCount) {
      return Response.json(
        {
          success: false,
          error: "ไม่พบ Accessory, อุปกรณ์ถูกคืนแล้ว หรือวันที่คืนไม่ถูกต้อง",
        },
        { status: 409 },
      );
    }

    return Response.json({ success: true, accessory: result.rows[0] });
  } catch (error) {
    console.error("Return accessory error:", error);

    if (error instanceof SyntaxError) {
      return Response.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 },
      );
    }

    return Response.json(
      { success: false, error: "ไม่สามารถคืน Accessory ได้" },
      { status: 500 },
    );
  }
}
