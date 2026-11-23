import { validateAssetLookups } from "@/lib/master-data";
import { getDbPool, query } from "@/lib/db";
import { requireWrite } from "@/lib/access";
import { auth } from "@/auth";
import { getItStockLocation } from "@/lib/it-stock";
import { parseSubtypeId, validateAssetSubtype } from "@/lib/asset-subtypes";
import { AssetWorkflowError } from "@/lib/asset-scan";
import {
  parseAssetAdditional,
  saveAssetAdditional,
} from "@/lib/asset-additional";
import {
  assetCodeSeriesPattern,
  buildAssetCode,
  parseAssetCodeNumber,
  parseRegistrationSiteId,
} from "@/lib/asset-code";

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
   // ==================================================
  // Permission
  // Admin / IT Staff เท่านั้นที่สร้าง Asset ได้
  // ==================================================
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }
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
  const assetName = text(body.assetName);
  let registrationSiteId;
  let assetCodeNumber;

  try {
    registrationSiteId = parseRegistrationSiteId(body.registrationSiteId);
    assetCodeNumber = parseAssetCodeNumber(body.assetCodeNumber);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if ((body.status && body.status !== "In Stock") || body.assetOwner || body.location) {
    return Response.json(
      { error: "เครื่องใหม่ต้องรับเข้าคลัง IT เป็น In Stock ก่อน และยังไม่ระบุผู้ครอบครอง" },
      { status: 400 },
    );
  }
  const session = await auth();

  // ตรวจสอบข้อมูลที่จำเป็น
  if (!type || !assetName) {
    return Response.json(
      { error: "กรุณาระบุประเภทและชื่อทรัพย์สิน" },
      { status: 400 },
    );
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

  let additional;
  try {
    additional = parseAssetAdditional(body);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (additional.maintenance?.sentAt) {
    return Response.json(
      { error: "กรุณาสร้าง Asset และรับเข้าคลัง IT ก่อนบันทึกการส่งซ่อม" },
      { status: 400 },
    );
  }

  // 4. เริ่มทำงานกับ PostgreSQL
  try {
    try { await validateAssetLookups(body); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }

    // หา ID ของประเภทจากชื่อที่ Frontend ส่งมา
    // เช่น "Monitor" → id = 3
    const [typeResult, registrationSiteResult] = await Promise.all([
      query(
        `SELECT id, prefix
         FROM public.asset_types
         WHERE name = $1
           AND is_active = true`,
        [type],
      ),
      query(
        `SELECT id, site_code
         FROM public.asset_registration_sites
         WHERE id = $1
           AND is_active = true`,
        [registrationSiteId],
      ),
    ]);

    if (registrationSiteResult.rows.length === 0) {
      return Response.json(
        { error: "ไม่พบบริษัทที่เลือก หรือถูกปิดใช้งาน" },
        { status: 400 },
      );
    }

    // ถ้าไม่พบประเภท ให้หยุดก่อน INSERT
    if (typeResult.rows.length === 0) {
      return Response.json({ error: "ไม่พบประเภททรัพย์สิน" }, { status: 400 });
    }

    // เอา ID ของประเภทมาใช้เป็น Foreign Key
    const assetTypeId = typeResult.rows[0].id;
    let subtypeId;
    try {
      subtypeId = await validateAssetSubtype({ query }, parseSubtypeId(body.subtypeId), assetTypeId);
    } catch (error) {
      if (!(error instanceof AssetWorkflowError)) throw error;
      return Response.json({ error: error.message }, { status: 400 });
    }
    const assetCode = buildAssetCode(
      registrationSiteResult.rows[0].site_code,
      typeResult.rows[0].prefix,
      assetCodeNumber,
    );

    // สร้างชื่อคอลัมน์และค่าจากรายการเดียวกัน เพื่อไม่ให้จำนวน VALUES
    // หรือหมายเลข $1, $2 คลาดเคลื่อนเมื่อเพิ่มช่อง Master Data
    // ชื่อคอลัมน์เป็นค่าคงที่ในโค้ด ส่วนข้อมูลจากฟอร์มส่งผ่าน parameters เท่านั้น
    const fields = [
      ["asset_code", assetCode],
      ["asset_type_id", assetTypeId],
      ["subtype_id", subtypeId],
      ["registration_site_id", registrationSiteId],
      ["received_date", receivedDate],
      ["asset_owner_id", null],
      ["asset_name", assetName],
      ["brand", text(body.brand)],
      ["model", text(body.model)],
      ["serial_number", text(body.serialNumber)],
      ["computer_name", text(body.computerName)],
      ["description", text(body.description)],
      ["status", "In Stock"],
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
      ["location_id", null],
      ["vendor_id", text(body.vendor)],
    ];

    // Server ประกอบรหัสเต็มจาก Site + Prefix + เลข 3 หลักที่ผ่าน Validation
    // จึงไม่เชื่อรหัสเต็มจาก browser และ Database ยังบังคับ Unique ซ้ำอีกชั้น
    const columns = fields.map(([column]) => column).join(", ");
    const placeholders = fields.map((_, index) => "$" + (index + 1)).join(", ");
    const client = await getDbPool().connect();
    try {
      await client.query("BEGIN");
      const itStock = await getItStockLocation(client);
      fields.find(([column]) => column === "location_id")[1] = itStock.id;
      // เลขรันแยกตามกลุ่มบริษัท (AMZAP/MEMO) + ปี + Asset Type
      // ล็อกตาม Type ภายใน Transaction ก่อนตรวจเลขซ้ำ ป้องกันสอง request
      // เลือกเลขเดียวกันพร้อมกันแล้วผ่านการตรวจทั้งคู่
      await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [
        assetTypeId,
      ]);

      const duplicateRunningNumber = await client.query(
        `SELECT asset_code
         FROM public.assets
         WHERE asset_type_id = $1
           AND right(asset_code, 3) = $2
           AND asset_code ~ $3
         LIMIT 1`,
        [
          assetTypeId,
          assetCodeNumber,
          assetCodeSeriesPattern(
            registrationSiteResult.rows[0].site_code,
            typeResult.rows[0].prefix,
          ),
        ],
      );

      if (duplicateRunningNumber.rowCount) {
        const conflict = new Error("Asset Type running number already exists");
        conflict.code = "ASSET_RUNNING_NUMBER_CONFLICT";
        conflict.assetCode = duplicateRunningNumber.rows[0].asset_code;
        throw conflict;
      }

      const result = await client.query(
        "INSERT INTO public.assets (" + columns + ") VALUES (" + placeholders + ") RETURNING id, asset_code, asset_name",
        fields.map(([, value]) => value),
      );

      await saveAssetAdditional(client, result.rows[0].id, additional, String(session.user.id));
      await client.query(
        `INSERT INTO public.asset_stock_receipts
         (asset_id,receipt_type,receipt_date,asset_condition,reason,received_by_account_id)
         VALUES ($1,'new',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date,'ready',$2,$3)`,
        [result.rows[0].id, "รับเครื่องใหม่เข้าคลัง IT", String(session.user.id)],
      );
      await client.query("COMMIT");

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
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // ถ้า SQL หรือ Database มีปัญหา
    // ให้ดูรายละเอียดจริงใน Terminal
    console.error("Save asset error:", error);
    if (error.code === "23505" && error.constraint === "assets_asset_code_key") {
      return Response.json({ error: "รหัส Asset นี้มีอยู่แล้ว กรุณาใช้เลขอื่น" }, { status: 409 });
    }
    if (
      error.code === "ASSET_RUNNING_NUMBER_CONFLICT" ||
      (error.code === "23505" &&
        error.constraint === "assets_asset_type_running_number_key")
    ) {
      const usedCode = error.assetCode ? ` (${error.assetCode})` : "";
      return Response.json(
        {
          error: `เลข Running นี้ถูกใช้กับ Asset Type เดียวกันแล้ว${usedCode} กรุณาใช้เลขอื่น`,
        },
        { status: 409 },
      );
    }
    if (error.code === "P0001" && error.message === "Asset code sequence exceeded 999") {
      return Response.json({ error: "เลขรหัส Asset ของโรงงานและประเภทนี้ครบ 999 แล้ว" }, { status: 409 });
    }

    return Response.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
