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

    // สร้างชื่อคอลัมน์และค่าจากรายการเดียวกัน เพื่อไม่ให้จำนวน VALUES
    // หรือหมายเลข $1, $2 คลาดเคลื่อนเมื่อเพิ่มช่อง Master Data
    // ชื่อคอลัมน์เป็นค่าคงที่ในโค้ด ส่วนข้อมูลจากฟอร์มส่งผ่าน parameters เท่านั้น
    const fields = [
      ["asset_type_id", assetTypeId],
      ["received_date", receivedDate],
      ["asset_owner_id", assetOwner],
      ["asset_name", assetName],
      ["brand", text(body.brand)],
      ["model", text(body.model)],
      ["serial_number", text(body.serialNumber)],
      ["computer_name", text(body.computerName)],
      ["description", text(body.description)],
      ["status", status],
      ["purchase_date", purchaseDate],
      ["purchase_price", purchasePrice],
      ["currency", "THB"],
      ["po_number", text(body.poNumber)],
      ["invoice_number", text(body.invoiceNumber)],
      ["warranty_start", warrantyStart],
      ["warranty_end", warrantyEnd],
      ["warranty_type", text(body.warrantyType)],
      ["cost_center", text(body.costCenter)],
      ["notes", text(body.notes)],
      ["owning_department_id", text(body.department)],
      ["location_id", text(body.location)],
      ["vendor_id", text(body.vendor)],
    ];
    // ถ้าไม่ระบุรหัส ให้ trigger เดิมสร้างรหัสตามประเภทและปีเหมือนเดิม
    if (assetCode) fields.unshift(["asset_code", assetCode]);
    const columns = fields.map(([column]) => column).join(", ");
    const placeholders = fields.map((_, index) => "$" + (index + 1)).join(", ");
    if (!assetCode) {
      // รหัสที่กรอกเองไม่ได้เพิ่ม counter ใน trigger เดิม จึงปรับ counter
      // ให้ไม่น้อยกว่าเลขที่ใช้จริงก่อนสร้างรหัสอัตโนมัติ โดยไม่แก้รหัส Asset เดิม
      // ON CONFLICT ใช้ GREATEST เพื่อไม่ลด counter ของ request อื่นที่ทำพร้อมกัน
      await query(`
        INSERT INTO public.asset_code_counters(asset_type_id, code_year, last_number)
        SELECT $1, EXTRACT(YEAR FROM CURRENT_DATE)::smallint,
          COALESCE(MAX(RIGHT(a.asset_code, 3)::integer), 0)
        FROM public.assets a
        JOIN public.asset_types t ON t.id = a.asset_type_id
        WHERE a.asset_type_id = $1
          AND a.asset_code_year = EXTRACT(YEAR FROM CURRENT_DATE)::smallint
          AND RIGHT(a.asset_code, 3) ~ '^[0-9]{3}$'
          AND a.asset_code = t.prefix || '-AMZ' || RIGHT(a.asset_code_year::text, 2) || '-' || RIGHT(a.asset_code, 3)
        ON CONFLICT(asset_type_id, code_year) DO UPDATE
        SET last_number = GREATEST(asset_code_counters.last_number, EXCLUDED.last_number)
      `, [assetTypeId]);
    }
    const result = await query(
      "INSERT INTO public.assets (" + columns + ") VALUES (" + placeholders + ") RETURNING id, asset_code, asset_name",
      fields.map(([, value]) => value),
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
    if (error.code === "23505" && error.constraint === "assets_asset_code_key") {
      return Response.json({ error: "รหัส Asset นี้มีอยู่แล้ว กรุณาใช้เลขอื่น หรือเว้นเลขท้ายให้ระบบสร้างรหัส" }, { status: 409 });
    }
    if (error.code === "P0001" && error.message === "Asset code sequence exceeded 999") {
      return Response.json({ error: "เลขรหัส Asset ของประเภทนี้ในปีนี้ครบ 999 แล้ว" }, { status: 409 });
    }

    return Response.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
