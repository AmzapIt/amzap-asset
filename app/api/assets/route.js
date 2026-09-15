import { validateAssetLookups } from "@/lib/master-data";
import { query } from "@/lib/db";

// บอก Next.js ให้ Route นี้ทำงานบน Node.js
// เพราะเราใช้ pg เชื่อม PostgreSQL
export const runtime = "nodejs";

// ฟังก์ชันช่วยจัดการข้อความจาก Form
// ถ้าเป็นข้อความว่าง จะเปลี่ยนเป็น null
function text(value) {
  return typeof value === "string" ? value.trim() || null : null;
}

// ตรวจสอบว่าวันที่เป็น yyyy-mm-dd และเป็นวันที่จริง
function validDate(value) {
  if (value === null) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
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
      { status: 500 },
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
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ตรวจสอบว่าข้อมูลที่รับมาเป็น Object
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  // 2. ดึงค่าจาก Form
  // เช่น body.type = "Monitor"
  const type = text(body.type);
  const assetCode = text(body.assetCode);
  const assetName = text(body.assetName);
  // ==================================================
  // Asset Owner จากหน้า Add
  //
  // HTML select ส่ง User ID เป็น String เช่น "27"
  // หากไม่ได้เลือก จะส่ง "" ให้บันทึกเป็น NULL
  //
  // เก็บ ID เป็น String สำหรับส่งเข้า parameter ของ SQL
  // PostgreSQL จะรับค่าเข้าคอลัมน์ asset_owner_id
  // ไม่ใช้ชื่อพนักงานเป็นตัวอ้างอิง เพราะชื่ออาจซ้ำหรือเปลี่ยนได้
  // ==================================================
  // รับเฉพาะ String หรือไม่มีค่า ตามรูปแบบที่หน้า Add ส่งมา
  // ป้องกัน Object, Array หรือชนิดข้อมูลอื่นถูกแปลงเป็น NULL เงียบ ๆ
  if (body.assetOwner != null && typeof body.assetOwner !== "string") {
    return Response.json(
      {
        success: false,
        error: "รูปแบบ Asset Owner ไม่ถูกต้อง",
      },
      { status: 400 },
    );
  }

  // อ่าน User ID จาก dropdown เช่น "27" หรือแปลงค่าว่างเป็น null
  // ประกาศก่อนตรวจสอบและก่อนส่งเข้า SQL เพื่อป้องกัน ReferenceError
  const assetOwner = text(body.assetOwner);

  // เมื่อเลือก Owner ต้องเป็น ID จำนวนเต็มบวกเท่านั้น
  // หากเป็น NULL ให้ผ่านได้ เพราะ Asset สามารถไม่มี Owner
  if (assetOwner !== null && !/^[1-9]\d*$/.test(assetOwner)) {
    return Response.json(
      {
        success: false,
        error: "Asset Owner ต้องเป็น User ID จำนวนเต็มบวก",
      },
      { status: 400 },
    );
  }
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
      { status: 400 },
    );
  }

  if (!allowedStatuses.includes(status)) {
    return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }

  // 3. เตรียมข้อมูลวันที่และราคา
  const receivedDate = text(body.receivedDate);
  const purchaseDate = text(body.purchaseDate);
  const purchasePrice = text(body.purchasePrice);
  const warrantyStart = text(body.warrantyStart);
  const warrantyEnd = text(body.warrantyEnd);

  // ตรวจสอบวันที่ก่อนส่งเข้า PostgreSQL
  if (
    ![receivedDate, purchaseDate, warrantyStart, warrantyEnd].every(validDate)
  ) {
    return Response.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  // วันหมดประกันต้องไม่ก่อนวันเริ่มประกัน
  if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
    return Response.json(
      { error: "วันหมดประกันต้องไม่ก่อนวันเริ่มประกัน" },
      { status: 400 },
    );
  }

  // PostgreSQL purchase_price เป็น NUMERIC(12,2)
  // จึงรับตัวเลขไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง
  if (purchasePrice !== null && !/^\d{1,10}(\.\d{1,2})?$/.test(purchasePrice)) {
    return Response.json(
      {
        error: "ราคาต้องเป็นตัวเลขไม่ติดลบ และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
      },
      { status: 400 },
    );
  }

  // 4. เริ่มทำงานกับ PostgreSQL
  try {
    // ==================================================
    // ตรวจ Owner กับข้อมูลจริงก่อนสร้าง Asset
    //
    // รายชื่อในหน้า Add อาจถูกโหลดไว้นานแล้ว
    // จึงตรวจซ้ำว่าพนักงานยังอยู่และมี status = 1
    // ใช้ $1 แยกค่าจาก SQL ไม่ต่อข้อความจากผู้ใช้ลงในคำสั่ง
    // ==================================================
    if (assetOwner !== null) {
      const ownerResult = await query(
        `SELECT id
     FROM public."user"
     WHERE id = $1
       AND status = 1
     LIMIT 1`,
        [assetOwner],
      );

      if (ownerResult.rows.length === 0) {
        return Response.json(
          {
            success: false,
            error: "ไม่พบพนักงานที่เลือก หรือพนักงานไม่ได้อยู่ในสถานะ Active",
          },
          { status: 400 },
        );
      }
    }

    try { await validateAssetLookups(body); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }

    // หา ID ของประเภทจากชื่อที่ Frontend ส่งมา
    // เช่น "Monitor" → id = 3
    const typeResult = await query(
      `SELECT id
       FROM asset_types
       WHERE name = $1
         AND is_active = TRUE`,
      [type],
    );

    // ถ้าไม่พบประเภท ให้หยุดก่อน INSERT
    if (typeResult.rows.length === 0) {
      return Response.json({ error: "ไม่พบประเภททรัพย์สิน" }, { status: 400 });
    }

    // เอา ID ของประเภทมาใช้เป็น Foreign Key
    const assetTypeId = typeResult.rows[0].id;

    // 5. INSERT ข้อมูลลงตาราง assets
    const insertColumns = assetCode ? "asset_code,\n        " : "";
    const insertValues = assetCode ? "$1,\n        " : "";
    const firstValue = assetCode ? "$2" : "$1";
    const insertParameters = assetCode
      ? [
          assetCode,
          assetTypeId,
          receivedDate,
          assetOwner,
          assetName,
          text(body.brand),
          text(body.model),
          text(body.serialNumber),
          text(body.computerName),
          text(body.description),
          status,
          purchaseDate,
          purchasePrice,
          "THB",
          text(body.poNumber),
          text(body.invoiceNumber),
          warrantyStart,
          warrantyEnd,
          text(body.warrantyType),
          text(body.costCenter),
          text(body.notes),
        ]
      : [
          assetTypeId,
          receivedDate,
          assetOwner,
          assetName,
          text(body.brand),
          text(body.model),
          text(body.serialNumber),
          text(body.computerName),
          text(body.description),
          status,
          purchaseDate,
          purchasePrice,
          "THB",
          text(body.poNumber),
          text(body.invoiceNumber),
          warrantyStart,
          warrantyEnd,
          text(body.warrantyType),
          text(body.costCenter),
          text(body.notes),
        ];

    const result = await query(
      `INSERT INTO assets (
        ${insertColumns} 
        asset_type_id,
        received_date,
        -- เก็บ User ID ที่เลือกจาก dropdown
        -- ให้หน้า Detail และ Edit อ่านผ่าน asset_owner_id ได้ตรงกัน
        -- ชื่อพนักงานดึงจาก public."user" ด้วย JOIN ตอนอ่านข้อมูล
        asset_owner_id,
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
        ${insertValues}${firstValue}, $${assetCode ? 3 : 2}, $${assetCode ? 4 : 3},
        $${assetCode ? 5 : 4}, $${assetCode ? 6 : 5}, $${assetCode ? 7 : 6},
        $${assetCode ? 8 : 7}, $${assetCode ? 9 : 8}, $${assetCode ? 10 : 9},
        $${assetCode ? 11 : 10}, $${assetCode ? 12 : 11}, $${assetCode ? 13 : 12},
        $${assetCode ? 14 : 13}, $${assetCode ? 15 : 14}, $${assetCode ? 16 : 15},
        $${assetCode ? 17 : 16}, $${assetCode ? 18 : 17}, $${assetCode ? 19 : 18},
        ${assetCode ? 20 : 19}, ${assetCode ? 21 : 20}, ${assetCode ? 22 : 21}, ${assetCode ? 23 : 22}, ${assetCode ? 24 : 23}
      )
      RETURNING id, asset_code, asset_name`,
      insertParameters,
    );

    // 6. PostgreSQL INSERT สำเร็จ
    // RETURNING จะส่งข้อมูล Asset ที่เพิ่งสร้างกลับมา
    return Response.json(
      {
        success: true,
        asset: result.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    // ถ้า SQL หรือ Database มีปัญหา
    // ให้ดูรายละเอียดจริงใน Terminal
    console.error("Save asset error:", error);

    return Response.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
