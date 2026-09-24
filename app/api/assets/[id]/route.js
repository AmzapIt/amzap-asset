import { validateAssetLookups } from "@/lib/master-data";
import { query } from "@/lib/db";
import { requireWrite } from "@/lib/access";

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
          u.full_name AS asset_owner_name,
          u.is_active AS asset_owner_is_active
        FROM public.assets a
        LEFT JOIN public.asset_types t
          ON t.id = a.asset_type_id
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
    return Response.json({
      success: true,
      asset,
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
    try { await validateAssetLookups(body,id); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }

    // ==================================================
    // แปลง Asset Owner
    //
    // Frontend อาจส่ง:
    // "27"
    //
    // Database ต้องการ:
    // 27
    //
    // ถ้าไม่ได้เลือก:
    // NULL
    // ==================================================
    const assetOwnerId =
      body.assetOwner === "" || body.assetOwner == null
        ? null
        : String(body.assetOwner).trim();

    // ==================================================
    // ตรวจ Asset Owner
    // ==================================================
    if (
      assetOwnerId !== null &&
      (!/^[1-9]\d{0,18}$/.test(assetOwnerId) ||
        BigInt(assetOwnerId) > 9223372036854775807n)
    ) {
      return Response.json(
        {
          success: false,
          error: "Invalid Asset Owner",
        },
        {
          status: 400,
        }
      );
    }

    if (assetOwnerId !== null) {
      const ownerResult = await query(
        `
          SELECT u.id
          FROM public."user" u
          WHERE u.id = $1
            AND (
              u.is_active = true
              OR EXISTS (
                SELECT 1
                FROM public.assets existing_asset
                WHERE existing_asset.id = $2
                  AND existing_asset.asset_owner_id = u.id
              )
            )
          LIMIT 1
        `,
        [assetOwnerId, id],
      );

      if (ownerResult.rows.length === 0) {
        return Response.json(
          {
            success: false,
            error: "Asset Owner must be an active employee",
          },
          { status: 400 },
        );
      }
    }

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

    // ==================================================
    // UPDATE Asset
    //
    // ใช้ parameter $1, $2, ...
    // ไม่เอาค่าจากผู้ใช้ต่อ SQL โดยตรง
    // ==================================================
    const result = await query(
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
          asset_owner_id = $9,
          purchase_date = $10,
          purchase_price = $11,
          po_number = $12,
          invoice_number = $13,
          warranty_start = $14,
          warranty_end = $15,
          warranty_type = $16,
          cost_center = $17,
          notes = $18,
          owning_department_id = CASE WHEN $20 THEN $21::bigint ELSE owning_department_id END,
          location_id = CASE WHEN $22 THEN $23::bigint ELSE location_id END,
          vendor_id = CASE WHEN $24 THEN $25::bigint ELSE vendor_id END,
          updated_at = NOW()
        WHERE id = $19
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
        assetOwnerId,
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
        // $20–$25 ต้องครบตาม CASE WHEN ใน SQL: แยกการไม่ส่ง field
        // (คงค่าเดิม) ออกจากการส่งค่าว่าง (ล้างค่าเป็น NULL)
        Object.hasOwn(body, "department"), body.department || null,
        Object.hasOwn(body, "location"), body.location || null,
        Object.hasOwn(body, "vendor"), body.vendor || null,
      ]
    );

    // ==================================================
    // ไม่พบ Asset
    // ==================================================
    if (result.rowCount === 0) {
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
    // ส่ง Asset ที่ Update แล้วกลับไป
    // ==================================================
    return Response.json({
      success: true,
      asset: result.rows[0],
    });

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
