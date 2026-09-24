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
    // ดึงเฉพาะพนักงานที่ Active
    // โดยให้เรียงชื่อตาม full_name
    const result = await query(`
      SELECT
        id,
        full_name,
        nickname,
        is_active
      FROM public."user"
      WHERE is_active = true
      ORDER BY full_name ASC
    `);

    // ส่งข้อมูลกลับเป็น JSON
    // users จะเป็น Array ของพนักงานที่ Active
    // nickname ใช้แสดงใน Dropdown เท่านั้น ส่วน Asset ยังคงอ้างอิงด้วย user.id
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
