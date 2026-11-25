import { query } from "@/lib/db";
import { workflowId } from "@/lib/asset-scan";
import { specsSections } from "@/lib/asset-specs-view";
import { assetWorkflowApi } from "@/lib/asset-workflow-api";

export const runtime = "nodejs";

// GET /api/assets/[id]/specs — สเปกย่อสำหรับกล่องลอยในหน้ารายการ (ไม่มีบัญชี Office)
export async function GET(request, { params }) {
  return assetWorkflowApi(false, async () => {
    const id = workflowId((await params).id);
    const row = (await query(
      `SELECT hostname, operating_system, cpu, ram_gb, storage_gb, bios_firmware,
              host(ip_address) AS ip_address, upper(mac_address::text) AS mac_address,
              extra_specs - 'officeAccount' AS extra_specs
         FROM public.asset_technical WHERE asset_id=$1`,
      [id],
    )).rows[0];
    return { sections: specsSections(row) };
  });
}
