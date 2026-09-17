import { auth } from "@/auth";
import { query } from "@/lib/db";

// =========================================================
// Role ที่สามารถเขียนข้อมูลทั่วไปได้
// =========================================================
const WRITE_ROLES = ["Admin", "IT Staff"];

/**
 * =========================================================
 * requireWrite()
 * =========================================================
 *
 * ใช้ป้องกัน API ที่มีการแก้ไข Database เช่น:
 *
 * - POST
 * - PATCH
 * - PUT
 * - DELETE
 *
 * ตัวอย่าง:
 *
 *   const denied = await requireWrite(request);
 *   if (denied) return denied;
 *
 * จะอนุญาต:
 * - Admin
 * - IT Staff
 *
 * จะไม่อนุญาต:
 * - Read-only
 *
 * ---------------------------------------------------------
 * ถ้าต้องการเฉพาะ Admin:
 *
 *   const denied = await requireWrite(request, "Admin");
 *   if (denied) return denied;
 *
 * ---------------------------------------------------------
 * เราตรวจ Account จาก Database ใหม่ทุกครั้งที่มีการ Write
 * ไม่เชื่อ Role จาก JWT อย่างเดียว
 *
 * ข้อดี:
 * - ถ้าปิด Account -> Write ไม่ได้ทันที
 * - ถ้าเปลี่ยน Role -> มีผลกับ Write ทันที
 * =========================================================
 */
export async function requireWrite(request, requiredRole = null) {
  try {
    // =====================================================
    // 1. ตรวจว่ามี Login Session หรือไม่
    // =====================================================
    const session = await auth();

    if (!session?.user?.id) {
      return Response.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // 2. โหลด Account ปัจจุบันจาก Database
    //
    // session.user.id = id ของ public.app_accounts
    // =====================================================
    const result = await query(
      `
        SELECT
          id,
          role,
          is_active
        FROM public.app_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [session.user.id]
    );

    const account = result.rows[0];

    // Account ถูกลบหรือหาไม่เจอ
    if (!account) {
      return Response.json(
        {
          error: "Account not found",
        },
        {
          status: 401,
        }
      );
    }

    // Account ถูกปิดใช้งาน
    if (!account.is_active) {
      return Response.json(
        {
          error: "Account is inactive",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 3. Endpoint ที่กำหนด Role เฉพาะ
    //
    // ตัวอย่าง:
    // requireWrite(request, "Admin")
    // =====================================================
    if (requiredRole && account.role !== requiredRole) {
      return Response.json(
        {
          error: "You do not have permission to perform this action",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 4. Write ทั่วไป
    //
    // ถ้าไม่ได้กำหนด Role เฉพาะ
    // ต้องเป็น Admin หรือ IT Staff
    // =====================================================
    if (!requiredRole && !WRITE_ROLES.includes(account.role)) {
      return Response.json(
        {
          error: "Read-only users cannot modify data",
        },
        {
          status: 403,
        }
      );
    }

    // null = อนุญาตให้ API ทำงานต่อ
    return null;
  } catch (error) {
    console.error("Authorization check failed:", error);

    return Response.json(
      {
        error: "Unable to verify permissions",
      },
      {
        status: 500,
      }
    );
  }
}