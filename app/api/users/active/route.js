import { query } from "@/lib/db";

// บังคับให้ Route นี้ทำงานบน Node.js
// เพราะใช้ PostgreSQL ผ่าน pg
export const runtime = "nodejs";

// ==================================================
// GET /api/users/active
// ใช้สำหรับดึงรายชื่อพนักงานที่ยัง Active
// เพื่อเอาไปแสดงใน Dropdown ของ Asset Owner
// ==================================================
export async function GET() {
  try {
    // ดึงเฉพาะพนักงานที่ status = 1
    // โดยให้เรียงชื่อตาม full_name
    const result = await query(`
      SELECT
        id,
        full_name,
        status
      FROM public."user"
      WHERE status = 1
      ORDER BY full_name ASC
    `);

    // ส่งข้อมูลกลับเป็น JSON
    // users จะเป็น Array ของพนักงานที่ Active
    return Response.json({
      success: true,
      users: result.rows,
    });

  } catch (error) {
    // แสดง Error ใน Terminal ฝั่ง Server
    console.error("Load active users error:", error);

    // ส่ง Error กลับไปให้ Frontend
    return Response.json(
      {
        success: false,
        message: "Unable to load active users",
      },
      { status: 500 }
    );
  }
}