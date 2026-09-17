import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

export const runtime = "nodejs";

// =========================================================
// PATCH /api/users/[id]/status
//
// ใช้เปลี่ยนสถานะพนักงาน
//
// status = 1 → Active
// status = 0 → Inactive
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
    // รองรับ:
    // { status: 1 }
    // { status: 0 }
    // =====================================================
    const body = await request.json();

    const status = Number(body.status);

    // =====================================================
    // status ต้องเป็น 0 หรือ 1 เท่านั้น
    // =====================================================
    if (![0, 1].includes(status)) {
      return Response.json(
        {
          success: false,
          error: "Status ต้องเป็น 0 หรือ 1",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // ให้ is_active กับ status ตรงกัน
    //
    // status 1 = Active
    // status 0 = Inactive
    // =====================================================
    const isActive = status === 1;

    // =====================================================
    // Update PostgreSQL
    // =====================================================
    const result = await query(
      `
        UPDATE public."user"
        SET
          status = $1,
          is_active = $2
        WHERE id = $3
        RETURNING
          id,
          employee_code,
          full_name,
          email,
          department_id,
          position,
          status,
          is_active,
          created_at
      `,
      [
        status,
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