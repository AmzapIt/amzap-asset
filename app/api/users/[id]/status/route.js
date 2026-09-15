import { query } from "@/lib/db";

export const runtime = "nodejs";

// ==================================================
// PATCH /api/users/[id]/status
// เปลี่ยนสถานะพนักงาน Active / Inactive
// ==================================================
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    // รับเฉพาะ ID ที่เป็นตัวเลขบวก
    if (!/^[1-9]\d*$/.test(id)) {
      return Response.json(
        {
          success: false,
          message: "Invalid user ID",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // status ต้องเป็น 0 หรือ 1 เท่านั้น
    const status = Number(body.status);

    if (![0, 1].includes(status)) {
      return Response.json(
        {
          success: false,
          message: "Status must be 0 or 1",
        },
        { status: 400 }
      );
    }

    // ให้ is_active ตรงกับ status เสมอ
    const isActive = status === 1;

    const result = await query(
      `
        UPDATE public."user"
        SET
          status = $1,
          is_active = $2
        WHERE id = $3
        RETURNING
          id,
          full_name,
          status,
          is_active
      `,
      [status, isActive, id]
    );

    if (result.rowCount === 0) {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      user: result.rows[0],
    });

  } catch (error) {
    console.error("Update user status error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to update user status",
      },
      { status: 500 }
    );
  }
}