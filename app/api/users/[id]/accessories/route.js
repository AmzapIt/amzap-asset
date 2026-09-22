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

function cleanText(value, maxLength) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  return value.trim() || null;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!validId(id)) {
      return Response.json(
        { success: false, error: "User ID ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const userResult = await query(
      `
        SELECT id
        FROM public."user"
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!userResult.rowCount) {
      return Response.json(
        { success: false, error: "ไม่พบพนักงาน" },
        { status: 404 },
      );
    }

    const result = await query(
      `
        SELECT
          ea.id,
          ea.user_id,
          ea.accessory_type_id,
          at.name AS accessory_type,
          ea.quantity,
          ea.brand,
          ea.model,
          ea.serial_number,
          ea.issued_date,
          ea.returned_date,
          ea.notes,
          ea.created_at
        FROM public.employee_accessories ea
        INNER JOIN public.accessory_types at
          ON at.id = ea.accessory_type_id
        WHERE ea.user_id = $1
        ORDER BY
          CASE WHEN ea.returned_date IS NULL THEN 0 ELSE 1 END,
          ea.issued_date DESC,
          ea.id DESC
      `,
      [id],
    );

    return Response.json({ success: true, accessories: result.rows });
  } catch (error) {
    console.error("GET employee accessories error:", error);
    return Response.json(
      { success: false, error: "ไม่สามารถโหลด Accessories ได้" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }

  try {
    const { id } = await params;

    if (!validId(id)) {
      return Response.json(
        { success: false, error: "User ID ไม่ถูกต้อง" },
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

    const accessoryTypeId =
      body.accessory_type_id == null ? "" : String(body.accessory_type_id);
    const quantity = Number(body.quantity);
    const brand = cleanText(body.brand, 150);
    const model = cleanText(body.model, 150);
    const serialNumber = cleanText(body.serial_number, 200);
    const issuedDate =
      typeof body.issued_date === "string" ? body.issued_date.trim() : "";
    const notes = cleanText(body.notes, 10000);

    if ([brand, model, serialNumber, notes].includes(undefined)) {
      return Response.json(
        { success: false, error: "ข้อมูล Accessory ยาวเกินกำหนด" },
        { status: 400 },
      );
    }

    if (!validId(accessoryTypeId)) {
      return Response.json(
        { success: false, error: "กรุณาเลือก Accessory Type" },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
      return Response.json(
        { success: false, error: "Quantity ต้องเป็นจำนวนเต็ม 1-100,000" },
        { status: 400 },
      );
    }

    if (issuedDate && !validDate(issuedDate)) {
      return Response.json(
        { success: false, error: "Issued Date ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const userResult = await query(
      `
        SELECT id
        FROM public."user"
        WHERE id = $1
          AND is_active = true
        LIMIT 1
      `,
      [id],
    );

    if (!userResult.rowCount) {
      return Response.json(
        { success: false, error: "ไม่พบพนักงาน Active" },
        { status: 400 },
      );
    }

    const typeResult = await query(
      `
        SELECT id
        FROM public.accessory_types
        WHERE id = $1
          AND is_active = true
        LIMIT 1
      `,
      [accessoryTypeId],
    );

    if (!typeResult.rowCount) {
      return Response.json(
        {
          success: false,
          error: "ไม่พบ Accessory Type หรือ Type ถูกปิดใช้งาน",
        },
        { status: 400 },
      );
    }

    const result = await query(
      `
        INSERT INTO public.employee_accessories (
          user_id,
          accessory_type_id,
          quantity,
          brand,
          model,
          serial_number,
          issued_date,
          notes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          COALESCE(
            $7::date,
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date
          ),
          $8
        )
        RETURNING *
      `,
      [
        id,
        accessoryTypeId,
        quantity,
        brand,
        model,
        serialNumber,
        issuedDate || null,
        notes,
      ],
    );

    return Response.json(
      { success: true, accessory: result.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST employee accessory error:", error);

    if (error instanceof SyntaxError) {
      return Response.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 },
      );
    }

    return Response.json(
      { success: false, error: "ไม่สามารถเพิ่ม Accessory ได้" },
      { status: 500 },
    );
  }
}
