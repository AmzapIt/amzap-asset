import { query } from "@/lib/db";
import { formatAssetCodeNumber } from "@/lib/asset-code";

export const runtime = "nodejs";

const bigintIdPattern = /^[1-9]\d{0,18}$/;

function validBigintId(value) {
  return (
    typeof value === "string" &&
    bigintIdPattern.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
// F1/F2 share a running number per Asset Type; M1 has a separate sequence.
// This read-only result does not reserve a number. Creation checks again.
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
          asset_type.prefix,
          (
            SELECT max(right(asset.asset_code, 3)::integer)
            FROM public.assets asset
            WHERE asset.asset_type_id = asset_type.id
              AND right(asset.asset_code, 3) ~ '^[0-9]{3}$'
              AND asset.asset_code ~ CASE
                WHEN registration_site.site_code = 'M1'
                  THEN '^M1-[A-Z0-9]{2,10}-[0-9]{3}$'
                ELSE '^F[0-9]{1,3}-[A-Z0-9]{2,10}-[0-9]{3}$'
              END
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
    const latestNumber = formatAssetCodeNumber(row.latest_number);

    return Response.json({
      success: true,
      latestNumber,
      assetTypePrefix: row.prefix,
    });
  } catch (error) {
    console.error("Load latest Asset Code error:", error);
    return Response.json(
      { success: false, error: "ไม่สามารถตรวจรหัส Asset ล่าสุดได้" },
      { status: 500 },
    );
  }
}
