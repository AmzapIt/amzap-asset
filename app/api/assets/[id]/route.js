import { validateAssetLookups } from "@/lib/master-data";
import { getDbPool, query } from "@/lib/db";
import { requireWrite } from "@/lib/access";
import {
  parseAssetAdditional,
  saveAssetAdditional,
} from "@/lib/asset-additional";

export const runtime = "nodejs";

// ==================================================
// GET /api/assets/[id]
//
// โหลด Asset รายตัวสำหรับหน้ารายละเอียดและหน้าแก้ไข
// คืนข้อมูล Asset พร้อม Asset Type และ Asset Owner
// โดยยังแสดง Owner เดิมได้แม้พนักงานถูกเปลี่ยนเป็น Inactive
// ==================================================
export async function GET(request, { params }) {
  try {
    // Next.js 16 รับ params เป็น Promise
    const { id } = await params;

    // ==================================================
    // ตรวจสอบว่า id เป็นเลขจำนวนเต็มบวก
    // ป้องกันค่าผิดรูปแบบเข้ามา Query
    // ==================================================
    if (!/^[1-9]\d*$/.test(id)) {
      return Response.json(
        {
          success: false,
          error: "Invalid asset ID",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // ดึงข้อมูล Asset
    //
    // ใช้ a.* เพื่อเอาคอลัมน์ของ assets ทั้งหมด
    // และดึงชื่อ Asset Type กับ Owner เดิมมาด้วย
    // LEFT JOIN โดยไม่กรอง status เพื่อให้ Owner ที่ Inactive ยังแสดงชื่อได้
    // หากไม่มี Owner จะยังคืน Asset ตามเดิม โดยชื่อและสถานะ Owner เป็น null
    // ==================================================
    const result = await query(
      `
        SELECT
          a.*,
          -- ส่ง DATE เป็น yyyy-mm-dd โดยตรง ไม่แปลงผ่าน JavaScript Date/UTC
          -- ป้องกันวันที่ถอยหนึ่งวันทุกครั้งที่เปิดฟอร์มแล้วบันทึก
          a.received_date::text AS received_date,
          a.purchase_date::text AS purchase_date,
          a.warranty_start::text AS warranty_start,
          a.warranty_end::text AS warranty_end,
          t.name AS asset_type,
          registration_site.site_code AS registration_site_code,
          registration_site.name AS registration_site_name,
          u.full_name AS asset_owner_name,
          u.nickname AS asset_owner_nickname,
          u.is_active AS asset_owner_is_active
        FROM public.assets a
        LEFT JOIN public.asset_types t
          ON t.id = a.asset_type_id
        LEFT JOIN public.asset_registration_sites registration_site
          ON registration_site.id = a.registration_site_id
        LEFT JOIN public."user" u
          ON u.id = a.asset_owner_id
        WHERE a.id = $1
        LIMIT 1
      `,
      [id]
    );

    // Asset ที่พบ
    const asset = result.rows[0];

    // ==================================================
    // ถ้าไม่พบ Asset
    // ==================================================
    if (!asset) {
      return Response.json(
        {
          success: false,
          error: "Asset not found",
        },
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // ส่งข้อมูลกลับไปให้หน้า Edit
    // ==================================================
    const [
      technicalResult,
      securityResult,
      documentsResult,
      maintenanceResult,
    ] =
      await Promise.all([
        query("SELECT * FROM public.asset_technical WHERE asset_id=$1", [id]),
        query(
          `SELECT *, last_security_check::text AS last_security_check,
                     last_asset_check::text AS last_asset_check
             FROM public.asset_security WHERE asset_id=$1`,
          [id],
        ),
        query(
          `SELECT id, document_type, file_name, storage_path, mime_type,
                  file_size_bytes, is_primary_photo, created_at
             FROM public.asset_documents WHERE asset_id=$1 ORDER BY id DESC`,
          [id],
        ),
        query(
          `SELECT id, maintenance_type, description, status,
                  (reported_at AT TIME ZONE 'Asia/Bangkok')::date::text AS reported_at,
                  (completed_at AT TIME ZONE 'Asia/Bangkok')::date::text AS completed_at,
                  vendor_id, cost, notes, created_at
             FROM public.asset_maintenance WHERE asset_id=$1 ORDER BY id DESC`,
          [id],
        ),
      ]);

    return Response.json({
      success: true,
      asset,
      additional: {
        technical: technicalResult.rows[0] || null,
        security: securityResult.rows[0] || null,
        documents: documentsResult.rows,
        maintenance: maintenanceResult.rows,
      },
    });

  } catch (error) {
    // แสดง Error ใน Terminal ฝั่ง Server
    console.error(
      "GET /api/assets/[id] error:",
      error
    );

    return Response.json(
      {
        success: false,
        error: "Unable to load asset",
      },
      {
        status: 500,
      }
    );
  }
}

// ==================================================
// PATCH /api/assets/[id]
//
// ใช้แก้ไขข้อมูล Asset รายตัว
//
// หมายเหตุ:
// - ไม่แก้ asset_code
// - ไม่แก้ asset_type_id
// - ไม่แก้ code_year
//
// เพราะ Database มี trigger protect_asset_identity()
// ป้องกันข้อมูล Identity เหล่านี้อยู่
// ==================================================
export async function PATCH(request, { params }) {
  // ==================================================
  // Permission
  // Admin / IT Staff เท่านั้นที่แก้ Asset ได้
  // ==================================================
  const denied = await requireWrite(request);

  if (denied) {
    return denied;
  }
  try {
    // Next.js 16 รับ params เป็น Promise
    const { id } = await params;

    // ==================================================
    // ตรวจสอบ Asset ID
    // ==================================================
    if (!/^[1-9]\d*$/.test(id)) {
      return Response.json(
        {
          success: false,
          error: "Invalid asset ID",
        },
        {
          status: 400,
        }
      );
    }

    // อ่านข้อมูล JSON ที่ Frontend ส่งมา
    const body = await request.json();
    // Owner, Department and Location are Movement fields. Generic Edit only
    // validates Vendor and cannot bypass asset_movements history.
    try { await validateAssetLookups({ vendor: body.vendor },id); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }

    // ==================================================
    // Purchase Price
    //
    // "" -> NULL
    // "12000" -> 12000
    // ==================================================
    const purchasePrice =
      body.purchasePrice === "" ||
      body.purchasePrice == null
        ? null
        : Number(body.purchasePrice);

    if (
      purchasePrice !== null &&
      (
        !Number.isFinite(purchasePrice) ||
        purchasePrice < 0
      )
    ) {
      return Response.json(
        {
          success: false,
          error: "Invalid purchase price",
        },
        {
          status: 400,
        }
      );
    }

    let additional;
    try {
      additional = parseAssetAdditional(body);
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const client = await getDbPool().connect();

    // ==================================================
    // UPDATE Asset
    //
    // ใช้ parameter $1, $2, ...
    // ไม่เอาค่าจากผู้ใช้ต่อ SQL โดยตรง
    // ==================================================
    try {
      await client.query("BEGIN");
      const result = await client.query(
      `
        UPDATE public.assets
        SET
          asset_name = $1,
          brand = $2,
          model = $3,
          serial_number = $4,
          computer_name = $5,
          description = $6,
          status = $7,
          received_date = $8,
          purchase_date = $9,
          purchase_price = $10,
          po_number = $11,
          invoice_number = $12,
          warranty_start = $13,
          warranty_end = $14,
          warranty_type = $15,
          cost_center = $16,
          notes = $17,
          vendor_id = CASE WHEN $19 THEN $20::bigint ELSE vendor_id END,
          updated_at = NOW()
        WHERE id = $18
        RETURNING *
      `,
      [
        body.assetName?.trim() || null,
        body.brand?.trim() || null,
        body.model?.trim() || null,
        body.serialNumber?.trim() || null,
        body.computerName?.trim() || null,
        body.description?.trim() || null,
        body.status || null,
        body.receivedDate || null,
        body.purchaseDate || null,
        purchasePrice,
        body.poNumber?.trim() || null,
        body.invoiceNumber?.trim() || null,
        body.warrantyStart || null,
        body.warrantyEnd || null,
        body.warrantyType?.trim() || null,
        body.costCenter?.trim() || null,
        body.notes?.trim() || null,
        id,
        // Vendor ยังแก้ในหน้า Edit ได้ตามเดิม ส่วน Movement fields ไม่อยู่ใน UPDATE นี้
        Object.hasOwn(body, "vendor"), body.vendor || null,
      ]
    );

    // ==================================================
    // ไม่พบ Asset
    // ==================================================
      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
      return Response.json(
        {
          success: false,
          error: "Asset not found",
        },
        {
          status: 404,
        }
      );
      }

      await saveAssetAdditional(client, id, additional);
      await client.query("COMMIT");

    // ==================================================
    // ส่ง Asset ที่ Update แล้วกลับไป
    // ==================================================
      return Response.json({
        success: true,
        asset: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(
      "PATCH /api/assets/[id] error:",
      error
    );

    return Response.json(
      {
        success: false,
        error: "Unable to update asset",
      },
      {
        status: 500,
      }
    );
  }
}
