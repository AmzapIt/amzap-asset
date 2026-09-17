import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

export const runtime = "nodejs";

// =========================================================
// ตรวจ User ID
// =========================================================
function validId(id) {
  return /^[1-9]\d*$/.test(String(id));
}

// =========================================================
// GET /api/users/[id]
// โหลดข้อมูลพนักงาน 1 คน
// =========================================================
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!validId(id)) {
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

    const result = await query(
      `
        SELECT
          u.id,
          u.employee_code,
          u.full_name,
          u.email,
          u.department_id,
          d.name AS department_name,
          d.is_active AS department_is_active,
          u.position,
          u.is_active,
          u.status,
          u.created_at
        FROM public."user" u
        LEFT JOIN public.departments d
          ON d.id = u.department_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [id],
    );

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

    return Response.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);

    return Response.json(
      {
        success: false,
        error: "ไม่สามารถโหลดข้อมูลพนักงานได้",
      },
      {
        status: 500,
      },
    );
  }
}

// =========================================================
// PATCH /api/users/[id]
// แก้ไขข้อมูลพนักงาน
// เฉพาะ Admin
// =========================================================
export async function PATCH(request, { params }) {
  const denied = await requireWrite(request, "Admin");

  if (denied) {
    return denied;
  }

  try {
    const { id } = await params;

    if (!validId(id)) {
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

    const body = await request.json();

    // =====================================================
    // Normalize ค่า
    // =====================================================
    const employeeCode =
      typeof body.employee_code === "string"
        ? body.employee_code.trim()
        : "";

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const position =
      typeof body.position === "string"
        ? body.position.trim()
        : "";

    const departmentId =
      body.department_id === "" || body.department_id == null
        ? null
        : String(body.department_id);

    const status = Number(body.status);

    // =====================================================
    // Validation
    // =====================================================
    if (!fullName) {
      return Response.json(
        {
          success: false,
          error: "กรุณากรอกชื่อพนักงาน",
        },
        {
          status: 400,
        },
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return Response.json(
        {
          success: false,
          error: "รูปแบบ Email ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    if (![0, 1].includes(status)) {
      return Response.json(
        {
          success: false,
          error: "Status ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // ตรวจ Department
    // =====================================================
    if (departmentId) {
      if (!/^[1-9]\d*$/.test(departmentId)) {
        return Response.json(
          {
            success: false,
            error: "Department ไม่ถูกต้อง",
          },
          {
            status: 400,
          },
        );
      }

      const departmentResult = await query(
        `
          SELECT id
          FROM public.departments
          WHERE id = $1
          LIMIT 1
        `,
        [departmentId],
      );

      if (!departmentResult.rowCount) {
        return Response.json(
          {
            success: false,
            error: "ไม่พบ Department",
          },
          {
            status: 400,
          },
        );
      }
    }

    // status กับ is_active ให้ตรงกัน
    const isActive = status === 1;

    const result = await query(
      `
        UPDATE public."user"
        SET
          employee_code = $1,
          full_name = $2,
          email = $3,
          department_id = $4,
          position = $5,
          is_active = $6,
          status = $7
        WHERE id = $8
        RETURNING
          id,
          employee_code,
          full_name,
          email,
          department_id,
          position,
          is_active,
          status,
          created_at
      `,
      [
        employeeCode || null,
        fullName,
        email || null,
        departmentId,
        position || null,
        isActive,
        status,
        id,
      ],
    );

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

    return Response.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);

    if (error.code === "23505") {
      return Response.json(
        {
          success: false,
          error: "Employee Code นี้มีอยู่ในระบบแล้ว",
        },
        {
          status: 409,
        },
      );
    }

    return Response.json(
      {
        success: false,
        error: "ไม่สามารถแก้ไขพนักงานได้",
      },
      {
        status: 500,
      },
    );
  }
}