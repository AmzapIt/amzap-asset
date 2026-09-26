import { query } from "@/lib/db";

export const runtime = "nodejs";

// Registration sites are intentionally read-only here. Their code becomes a
// permanent part of Asset Code and must not be changed through generic master
// data editing after assets have been registered.
export async function GET() {
  try {
    const result = await query(`
      SELECT id::text AS id, site_code, name
      FROM public.asset_registration_sites
      WHERE is_active = true
      ORDER BY id
    `);

    return Response.json({ success: true, sites: result.rows });
  } catch (error) {
    console.error("Load asset registration sites error:", error);
    return Response.json(
      { success: false, error: "ไม่สามารถโหลดสถานที่ขึ้นทะเบียนได้" },
      { status: 500 },
    );
  }
}
