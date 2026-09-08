import { query } from "@/lib/db";

// บอก Next.js ให้ Route นี้ทำงานบน Node.js
// เพราะเราใช้ pg เชื่อม PostgreSQL
export const runtime = "nodejs";

// ฟังก์ชันช่วยจัดการข้อความจาก Form
// ถ้าเป็นข้อความว่าง จะเปลี่ยนเป็น null
function text(value) {
  return typeof value === "string"
    ? value.trim() || null
    : null;
}

// ตรวจสอบว่าวันที่เป็น yyyy-mm-dd และเป็นวันที่จริง
function validDate(value) {
  if (value === null) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// ==================================================
// GET /api/assets
// ใช้ตรวจสอบ Database และจำนวน Asset
// ==================================================
export async function GET() {
  try {
    // ส่ง SQL ไป PostgreSQL
    const result = await query(`
      SELECT
        current_database() AS database_name,
        COUNT(*)::integer AS total_assets
      FROM assets
    `);

    // ส่งผลลัพธ์กลับเป็น JSON
    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    // แสดง Error จริงใน Terminal ฝั่ง Server
    console.error("Database error:", error);

    // ไม่ส่งรายละเอียด Database กลับไปให้ Browser
    return Response.json(
      {
        success: false,
        error: "Database connection failed",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST /api/assets
// รับข้อมูลจาก Add Asset แล้วบันทึกลง PostgreSQL
// ==================================================
export async function POST(request) {
  let body;

  // 1. อ่าน JSON ที่ส่งมาจาก Frontend
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // ตรวจสอบว่าข้อมูลที่รับมาเป็น Object
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // 2. ดึงค่าจาก Form
  // เช่น body.type = "Monitor"
  const type = text(body.type);
  const assetName = text(body.assetName);
  const status = text(body.status) || "In Stock";

  // รายการสถานะที่ Database อนุญาต
  const allowedStatuses = [
    "In Stock",
    "In Use",
    "Repair",
    "Spare",
    "Retired",
    "Disposed",
    "Lost",
  ];

  // ตรวจสอบข้อมูลที่จำเป็น
  if (!type || !assetName) {
    return Response.json(
      { error: "กรุณาระบุประเภทและชื่อทรัพย์สิน" },
      { status: 400 }
    );
  }

  if (!allowedStatuses.includes(status)) {
    return Response.json(
      { error: "สถานะไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // 3. เตรียมข้อมูลวันที่และราคา
  const purchaseDate = text(body.purchaseDate);
  const purchasePrice = text(body.purchasePrice);
  const warrantyStart = text(body.warrantyStart);
  const warrantyEnd = text(body.warrantyEnd);

  // ตรวจสอบวันที่ก่อนส่งเข้า PostgreSQL
  if (
    ![
      purchaseDate,
      warrantyStart,
      warrantyEnd,
    ].every(validDate)
  ) {
    return Response.json(
      { error: "รูปแบบวันที่ไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // วันหมดประกันต้องไม่ก่อนวันเริ่มประกัน
  if (
    warrantyStart &&
    warrantyEnd &&
    warrantyEnd < warrantyStart
  ) {
    return Response.json(
      { error: "วันหมดประกันต้องไม่ก่อนวันเริ่มประกัน" },
      { status: 400 }
    );
  }

  // PostgreSQL purchase_price เป็น NUMERIC(12,2)
  // จึงรับตัวเลขไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง
if (
  purchasePrice !== null &&
  !/^\d{1,10}(\.\d{1,2})?$/.test(purchasePrice)
) {
  return Response.json(
    {
      error:
        "ราคาต้องเป็นตัวเลขไม่ติดลบ และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    },
    { status: 400 }
  );
}

  // 4. เริ่มทำงานกับ PostgreSQL
  try {
    // หา ID ของประเภทจากชื่อที่ Frontend ส่งมา
    // เช่น "Monitor" → id = 3
    const typeResult = await query(
      `SELECT id
       FROM asset_types
       WHERE name = $1
         AND is_active = TRUE`,
      [type]
    );

    // ถ้าไม่พบประเภท ให้หยุดก่อน INSERT
    if (typeResult.rows.length === 0) {
      return Response.json(
        { error: "ไม่พบประเภททรัพย์สิน" },
        { status: 400 }
      );
    }

    // เอา ID ของประเภทมาใช้เป็น Foreign Key
    const assetTypeId = typeResult.rows[0].id;

    // 5. INSERT ข้อมูลลงตาราง assets
    const result = await query(
      `INSERT INTO assets (
        asset_type_id,
        asset_name,
        brand,
        model,
        serial_number,
        computer_name,
        description,
        status,
        purchase_date,
        purchase_price,
        currency,
        po_number,
        invoice_number,
        warranty_start,
        warranty_end,
        warranty_type,
        cost_center,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18
      )
      RETURNING id, asset_code, asset_name`,
      [
        assetTypeId,                 // $1
        assetName,                   // $2
        text(body.brand),            // $3
        text(body.model),            // $4
        text(body.serialNumber),     // $5
        text(body.computerName),     // $6
        text(body.description),      // $7
        status,                      // $8
        purchaseDate,                // $9
        purchasePrice,               // $10
        "THB",                       // $11
        text(body.poNumber),         // $12
        text(body.invoiceNumber),    // $13
        warrantyStart,               // $14
        warrantyEnd,                 // $15
        text(body.warrantyType),     // $16
        text(body.costCenter),       // $17
        text(body.notes),            // $18
      ]
    );

    // 6. PostgreSQL INSERT สำเร็จ
    // RETURNING จะส่งข้อมูล Asset ที่เพิ่งสร้างกลับมา
    return Response.json(
      {
        success: true,
        asset: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    // ถ้า SQL หรือ Database มีปัญหา
    // ให้ดูรายละเอียดจริงใน Terminal
    console.error("Save asset error:", error);

    return Response.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}