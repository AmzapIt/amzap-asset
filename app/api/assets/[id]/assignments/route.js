import {
  changeAssignment,
  AssignmentError,
} from "@/lib/assignments";

import { requireWrite } from "@/lib/access";
import { auth } from "@/auth";

export const runtime = "nodejs";

// =========================================================
// POST /api/assets/[id]/assignments
//
// รองรับ:
// - assign
// - return
// - change assignee
//
// Admin / IT Staff เท่านั้น
// =========================================================
export async function POST(request, { params }) {
  // =====================================================
  // 1. Permission
  // =====================================================
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }

  // =====================================================
  // 2. Asset ID
  // =====================================================
  const { id } = await params;

  // =====================================================
  // 3. อ่าน JSON
  // =====================================================
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "Invalid JSON",
      },
      {
        status: 400,
      }
    );
  }

  // =====================================================
  // 4. ทำ Assignment
  //
  // Validation + Transaction หลักอยู่ใน:
  // lib/assignments.js
  // =====================================================
  try {
    const session = await auth();
    const assignment = await changeAssignment(id, body, String(session.user.id));

    return Response.json({
      success: true,
      assignment,
    });
  } catch (error) {
    // Error ที่ lib/assignments.js ตั้งใจให้แสดงกับผู้ใช้
    if (error instanceof AssignmentError) {
      return Response.json(
        {
          error: error.message,
        },
        {
          status: error.status || 400,
        }
      );
    }

    // Error จริงของ Database ไม่ส่งรายละเอียดกลับ Browser
    console.error("Assignment error:", error);

    return Response.json(
      {
        error: "Unable to update assignment",
      },
      {
        status: 500,
      }
    );
  }
}
