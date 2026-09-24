import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

export const runtime = "nodejs";

// =========================================================
// PATCH /api/users/[id]/status
//
// ใช้เปลี่ยนสถานะพนักงาน
//
// เฉพาะ Admin
// =========================================================
export async function PATCH(request, { params }) {
  // ตรวจสิทธิ์ก่อน
  const denied = await requireWrite(request, "Admin");

  if (denied) {
    return denied;
  }

  try {
    const { id } = await params;

    // =====================================================
    // ตรวจ User ID
    // =====================================================
    if (!/^[1-9]\d*$/.test(String(id))) {
      return Response.json(
        {
          success: false,
          error: "User ID ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // อ่านค่าที่ Frontend ส่งมา
    //
    // รองรับ { is_active: true } หรือ { is_active: false }
    // =====================================================
    const body = await request.json();

    const isActive = body.is_active;

    // =====================================================
    // is_active ต้องเป็น boolean เท่านั้น
    // =====================================================
    if (typeof isActive !== "boolean") {
      return Response.json(
        {
          success: false,
          error: "is_active ต้องเป็น boolean",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // Update PostgreSQL
    // =====================================================
    const result = await query(
      `
        UPDATE public."user"
        SET is_active = $1
        WHERE id = $2
        RETURNING
          id,
          employee_code,
          full_name,
          email,
          department_id,
          location_id,
          position,
          is_active,
          created_at
      `,
      [
        isActive,
        id,
      ],
    );

    // =====================================================
    // ไม่พบ User
    // =====================================================
    if (!result.rowCount) {
      return Response.json(
        {
          success: false,
          error: "ไม่พบพนักงาน",
        },
        {
          status: 404,
        },
      );
    }

    // =====================================================
    // สำเร็จ
    // =====================================================
    return Response.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error(
      "PATCH /api/users/[id]/status error:",
      error,
    );

    return Response.json(
      {
        success: false,
        error: "ไม่สามารถเปลี่ยนสถานะพนักงานได้",
      },
      {
        status: 500,
      },
    );
  }
}
