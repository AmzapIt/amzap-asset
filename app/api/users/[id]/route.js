import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";
import { inventorySchema } from "@/lib/inventory-schema";

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
          u.full_name_en,
          u.nickname,
          u.nickname_en,
          u.email,
          u.department_id,
          d.name AS department_name,
          d.is_active AS department_is_active,
          u.location_id,
          l.name AS location_name,
          l.is_active AS location_is_active,
          u.position,
          u.is_active,
          u.created_at
        FROM public."user" u
        LEFT JOIN public.departments d
          ON d.id = u.department_id
        LEFT JOIN public.locations l
          ON l.id = u.location_id
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

    const fullNameEn =
      typeof body.full_name_en === "string"
        ? body.full_name_en.trim()
        : "";

    const nickname =
      typeof body.nickname === "string" ? body.nickname.trim() : "";

    const nicknameEn =
      typeof body.nickname_en === "string" ? body.nickname_en.trim() : "";

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

    const locationId =
      body.location_id === "" || body.location_id == null
        ? null
        : String(body.location_id);

    const validActivityValues = [true, false, "true", "false"];
    const isActive = body.is_active === true || body.is_active === "true";

    if (isActive) {
      const openOffboarding = await query(
        "SELECT 1 FROM public.employee_offboardings WHERE user_id=$1 AND closed_at IS NULL",
        [id],
      );
      if (openOffboarding.rowCount) {
        return Response.json(
          { error: "กรุณาปิดเคสตรวจคืนก่อนเปิดใช้งานพนักงานอีกครั้ง" },
          { status: 409 },
        );
      }
    }

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

    if (!validActivityValues.includes(body.is_active)) {
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

    if (fullNameEn.length > 200) {
      return Response.json(
        { success: false, error: "Full Name (English) ต้องไม่เกิน 200 ตัวอักษร" },
        { status: 400 },
      );
    }

    if (nickname.length > 100 || nicknameEn.length > 100) {
      return Response.json(
        { success: false, error: "Nickname ต้องไม่เกิน 100 ตัวอักษร" },
        { status: 400 },
      );
    }

    if (locationId) {
      if (!/^[1-9]\d*$/.test(locationId)) {
        return Response.json(
          { success: false, error: "Location ไม่ถูกต้อง" },
          { status: 400 },
        );
      }

      const locationResult = await query(
        `
          SELECT id
          FROM public.locations
          WHERE id = $1
          LIMIT 1
        `,
        [locationId],
      );

      if (!locationResult.rowCount) {
        return Response.json(
          { success: false, error: "ไม่พบ Location" },
          { status: 400 },
        );
      }
    }

    const result = await query(
      `
        UPDATE public."user"
        SET
          employee_code = $1,
          full_name = $2,
          email = $3,
          department_id = $4,
          location_id = $5,
          position = $6,
          is_active = $7,
          nickname = $8,
          full_name_en = CASE WHEN $12 THEN $9 ELSE full_name_en END,
          nickname_en = CASE WHEN $13 THEN $10 ELSE nickname_en END
        WHERE id = $11
        RETURNING
          id,
          employee_code,
          full_name,
          full_name_en,
          nickname,
          nickname_en,
          email,
          department_id,
          location_id,
          position,
          is_active,
          created_at
      `,
      [
        employeeCode || null,
        fullName,
        email || null,
        departmentId,
        locationId,
        position || null,
        isActive,
        nickname || null,
        fullNameEn || null,
        nicknameEn || null,
        id,
        Object.hasOwn(body, "full_name_en"),
        Object.hasOwn(body, "nickname_en"),
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

// =========================================================
// DELETE /api/users/[id]
// ลบพนักงานถาวรได้เฉพาะเมื่อไม่มีข้อมูลอื่นอ้างอิง
// =========================================================
export async function DELETE(request, { params }) {
  const denied = await requireWrite(request, "Admin");

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

    const schema = await inventorySchema({ query });
    const licenseDependency = schema.licenses
      ? `(SELECT COUNT(*)::int FROM public.license_seat_assignments license
            WHERE license.user_id=u.id) AS license_assignments`
      : '0::int AS license_assignments';
    const consumableDependency = schema.consumables
      ? `(SELECT COUNT(*)::int FROM public.consumable_movements consumable
            WHERE consumable.user_id=u.id) AS consumable_movements`
      : '0::int AS consumable_movements';
    const dependencyResult = await query(
      `
        SELECT
          u.id,
          u.full_name,
          (SELECT COUNT(*)::int FROM public.assets a
            WHERE a.asset_owner_id = u.id) AS owned_assets,
          (SELECT COUNT(*)::int FROM public.asset_assignments aa
            WHERE aa.assigned_to = u.id) AS assignments,
          (SELECT COUNT(*)::int FROM public.asset_movements movement
            WHERE movement.from_owner_id = u.id
               OR movement.to_owner_id = u.id) AS movements,
          (SELECT COUNT(*)::int FROM public.employee_accessories ea
            WHERE ea.user_id = u.id) AS accessories,
          (SELECT COUNT(*)::int FROM public.accessory_stock_movements am
            WHERE am.from_user_id=u.id OR am.to_user_id=u.id) AS accessory_movements,
          ${licenseDependency},
          ${consumableDependency},
          (SELECT COUNT(*)::int FROM public.asset_audit_logs al
            WHERE al.changed_by = u.id) AS audit_logs,
          (SELECT COUNT(*)::int FROM public.asset_documents ad
            WHERE ad.uploaded_by = u.id) AS documents,
          (SELECT COUNT(*)::int FROM public.app_accounts account
            WHERE account.user_id = u.id) AS login_accounts
        FROM public."user" u
        WHERE u.id = $1
        LIMIT 1
      `,
      [id],
    );

    const user = dependencyResult.rows[0];

    if (!user) {
      return Response.json(
        { success: false, error: "ไม่พบพนักงาน" },
        { status: 404 },
      );
    }

    const dependencies = {
      owned_assets: Number(user.owned_assets),
      assignments: Number(user.assignments),
      movements: Number(user.movements),
      accessories: Number(user.accessories),
      accessory_movements: Number(user.accessory_movements),
      license_assignments: Number(user.license_assignments),
      consumable_movements: Number(user.consumable_movements),
      audit_logs: Number(user.audit_logs),
      documents: Number(user.documents),
      login_accounts: Number(user.login_accounts),
    };

    if (Object.values(dependencies).some((count) => count > 0)) {
      return Response.json(
        {
          success: false,
          error:
            "ไม่สามารถลบพนักงานได้ เนื่องจากยังมีข้อมูลอ้างอิง กรุณาโอน/คืนรายการที่เกี่ยวข้อง หรือเปลี่ยนสถานะพนักงานเป็น Inactive",
          dependencies,
        },
        { status: 409 },
      );
    }

    const deleteResult = await query(
      `DELETE FROM public."user" WHERE id = $1 RETURNING id, full_name`,
      [id],
    );

    if (!deleteResult.rowCount) {
      return Response.json(
        { success: false, error: "ไม่พบพนักงาน" },
        { status: 404 },
      );
    }

    return Response.json({
      success: true,
      deleted_user: deleteResult.rows[0],
    });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);

    if (error.code === "23503") {
      return Response.json(
        {
          success: false,
          error:
            "ไม่สามารถลบพนักงานได้ เนื่องจากมีข้อมูลใหม่อ้างอิงพนักงานคนนี้ กรุณาลองตรวจสอบอีกครั้ง",
        },
        { status: 409 },
      );
    }

    return Response.json(
      { success: false, error: "ไม่สามารถลบพนักงานได้" },
      { status: 500 },
    );
  }
}
