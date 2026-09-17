import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

export const runtime = "nodejs";

// =========================================================
// GET /api/users
//
// ใช้ดึงรายชื่อพนักงานทั้งหมด
// =========================================================
export async function GET() {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.employee_code,
        u.full_name,
        u.email,
        u.department_id,
        d.name AS department_name,
        u.position,
        u.is_active,
        u.status,
        u.created_at
      FROM public."user" u
      LEFT JOIN public.departments d
        ON d.id = u.department_id
      ORDER BY u.id
    `);

    return Response.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("GET users error:", error);

    return Response.json(
      {
        success: false,
        error: "ไม่สามารถโหลดข้อมูลพนักงานได้",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST /api/users
//
// เพิ่มพนักงานใหม่
// เฉพาะ Admin
// =========================================================
export async function POST(request) {
  const denied = await requireWrite(request, "Admin");

  if (denied) {
    return denied;
  }

  try {
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
      body.department_id === "" ||
      body.department_id == null
        ? null
        : String(body.department_id);

    const status = Number(body.status);

    // =====================================================
    // Validation
    // =====================================================
    if (!fullName) {
      return Response.json(
        {
          error: "กรุณากรอกชื่อพนักงาน",
        },
        {
          status: 400,
        }
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return Response.json(
        {
          error: "รูปแบบ Email ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    if (![0, 1].includes(status)) {
      return Response.json(
        {
          error: "สถานะพนักงานไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // ตรวจ Department
    //
    // Employee ใหม่เลือกได้เฉพาะ Department Active
    // =====================================================
    if (departmentId) {
      if (!/^[1-9]\d*$/.test(departmentId)) {
        return Response.json(
          {
            error: "Department ไม่ถูกต้อง",
          },
          {
            status: 400,
          }
        );
      }

      const departmentResult = await query(
        `
          SELECT id
          FROM public.departments
          WHERE id = $1
            AND is_active = true
          LIMIT 1
        `,
        [departmentId]
      );

      if (!departmentResult.rowCount) {
        return Response.json(
          {
            error:
              "ไม่พบ Department หรือ Department ถูกปิดใช้งาน",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // status และ is_active ต้องไปทางเดียวกัน
    //
    // status = 1 → is_active = true
    // status = 0 → is_active = false
    // =====================================================
    const isActive = status === 1;

    const result = await query(
      `
        INSERT INTO public."user" (
          employee_code,
          full_name,
          email,
          department_id,
          position,
          is_active,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
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
      ]
    );

    return Response.json(
      {
        success: true,
        user: result.rows[0],
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("POST user error:", error);

    // employee_code UNIQUE
    if (error.code === "23505") {
      return Response.json(
        {
          error:
            "Employee Code นี้มีอยู่ในระบบแล้ว",
        },
        {
          status: 409,
        }
      );
    }

    return Response.json(
      {
        success: false,
        error: "ไม่สามารถเพิ่มพนักงานได้",
      },
      {
        status: 500,
      }
    );
  }
}