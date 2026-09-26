import { query } from "@/lib/db";

export const runtime = "nodejs";

const bigintIdPattern = /^[1-9]\d{0,18}$/;

function validBigintId(value) {
  return (
    typeof value === "string" &&
    bigintIdPattern.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
// Return the highest code that currently exists for one registration site and
// Asset Type. This endpoint is read-only; the result is informational and does
// not reserve the next number.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const registrationSiteId = searchParams.get("registrationSiteId");
  const assetTypeId = searchParams.get("assetTypeId");

  if (!validBigintId(registrationSiteId) || !validBigintId(assetTypeId)) {
    return Response.json(
      { success: false, error: "ข้อมูล Site หรือ Asset Type ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    const result = await query(
      `
        SELECT
          registration_site.site_code,
          asset_type.prefix,
          (
            SELECT max(right(asset.asset_code, 3)::integer)
            FROM public.assets asset
            WHERE asset.registration_site_id = registration_site.id
              AND asset.asset_type_id = asset_type.id
              AND right(asset.asset_code, 3) ~ '^[0-9]{3}$'
              AND asset.asset_code = registration_site.site_code
                || '-' || asset_type.prefix || '-'
                || right(asset.asset_code, 3)
          ) AS latest_number
        FROM public.asset_registration_sites registration_site
        CROSS JOIN public.asset_types asset_type
        WHERE registration_site.id = $1
          AND registration_site.is_active = true
          AND asset_type.id = $2
          AND asset_type.is_active = true
        LIMIT 1
      `,
      [registrationSiteId, assetTypeId],
    );

    if (!result.rowCount) {
      return Response.json(
        { success: false, error: "ไม่พบ Site หรือ Asset Type ที่เลือก" },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    const latestNumber =
      row.latest_number == null ? null : String(row.latest_number).padStart(3, "0");

    return Response.json({
      success: true,
      latestNumber,
      latestCode:
        latestNumber == null
          ? null
          : `${row.site_code}-${row.prefix}-${latestNumber}`,
    });
  } catch (error) {
    console.error("Load latest Asset Code error:", error);
    return Response.json(
      { success: false, error: "ไม่สามารถตรวจรหัส Asset ล่าสุดได้" },
      { status: 500 },
    );
  }
}
