import { getDbPool, query } from "@/lib/db";
import { mergeAssetTechnical } from "@/lib/asset-additional";
import { recordAssetEdit } from "@/lib/asset-history";
import { AssetWorkflowError } from "@/lib/asset-scan";
import { assetWorkflowApi } from "@/lib/asset-workflow-api";
import { getMachineSpecsEnabled } from "@/lib/machine-specs-settings";
import { assetIdentityChanges, planMachineSpecsImport } from "@/lib/machine-specs";

export const runtime = "nodejs";

const MAX_FILES = 200;
const MAX_FILE_LENGTH = 5000;
const ASSET_COLUMNS = `id::text, asset_code, asset_name, brand, model, serial_number,
  upper(regexp_replace(coalesce(serial_number, ''), '\\s', '', 'g')) AS serial`;
// ใช้ทั้งก่อนและหลัง UPDATE ให้ประวัติการแก้ไขเทียบค่าได้ตรงกับหน้าแก้ไข Asset
const HISTORY_COLUMNS = `*, received_date::text AS received_date, purchase_date::text AS purchase_date,
  warranty_start::text AS warranty_start, warranty_end::text AS warranty_end`;

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > MAX_FILES * (MAX_FILE_LENGTH + 400)) throw new AssetWorkflowError("ข้อมูลใหญ่เกินไป", 413);
  const body = JSON.parse(raw);
  const files = Array.isArray(body?.files) ? body.files : null;
  if (!files || files.length === 0) throw new AssetWorkflowError("กรุณาเลือกไฟล์ .json อย่างน้อย 1 ไฟล์");
  if (files.length > MAX_FILES) throw new AssetWorkflowError(`นำเข้าได้ครั้งละไม่เกิน ${MAX_FILES} ไฟล์`);

  // manual: { "<ลำดับไฟล์>": "รหัส Asset" } สำหรับไฟล์ที่จับคู่ด้วย Serial ไม่ได้
  const manual = new Map();
  if (body.manual && typeof body.manual === "object" && !Array.isArray(body.manual)) {
    for (const [key, value] of Object.entries(body.manual)) {
      const index = Number(key);
      const code = typeof value === "string" ? value.trim().toUpperCase() : "";
      if (Number.isInteger(index) && index >= 0 && index < files.length && code && code.length <= 50) {
        manual.set(index, code);
      }
    }
  }

  return {
    files: files.map((file) => ({
      fileName: typeof file?.fileName === "string" ? file.fileName.slice(0, 255) : "",
      text: typeof file?.text === "string" ? file.text.slice(0, MAX_FILE_LENGTH + 1) : "",
    })),
    manual,
    overwrite: body.overwriteBrandModel !== false,
  };
}

// หา Asset ตาม Serial (ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่าง)
async function assetsBySerial(serials) {
  if (serials.length === 0) return new Map();
  const rows = (await query(
    `SELECT ${ASSET_COLUMNS} FROM public.assets
     WHERE upper(regexp_replace(serial_number, '\\s', '', 'g')) = ANY($1::text[])
     ORDER BY asset_code`,
    [serials],
  )).rows;
  const map = new Map();
  for (const row of rows) map.set(row.serial, [...(map.get(row.serial) || []), row]);
  return map;
}

async function assetsByCode(codes) {
  if (codes.length === 0) return new Map();
  const rows = (await query(
    `SELECT ${ASSET_COLUMNS} FROM public.assets WHERE upper(asset_code) = ANY($1::text[])`,
    [codes],
  )).rows;
  return new Map(rows.map((row) => [row.asset_code.toUpperCase(), row]));
}

function changesFor(item, asset, overwrite) {
  return assetIdentityChanges(
    { brand: asset.brand, model: asset.model, serialNumber: asset.serial_number },
    { asset: item.machine, serialNumber: item.serialNumber },
    { overwrite },
  );
}

function withChanges(item, asset, overwrite, extra = {}) {
  return { ...item, ...extra, status: "ready", asset, changes: changesFor(item, asset, overwrite) };
}

async function buildPlan(request) {
  if (!await getMachineSpecsEnabled()) {
    throw new AssetWorkflowError("ฟีเจอร์สคริปต์ตรวจเครื่องปิดอยู่ เปิดได้ที่ Settings → สคริปต์ตรวจเครื่อง", 403);
  }
  const { files, manual, overwrite } = await readBody(request);
  const plan = planMachineSpecsImport(files.map((file) => (
    file.text.length > MAX_FILE_LENGTH ? { ...file, text: "" } : file
  )));
  const [bySerial, byCode] = await Promise.all([
    assetsBySerial([...new Set(plan.filter((item) => item.serialNumber).map((item) => item.serialNumber))]),
    assetsByCode([...new Set(manual.values())]),
  ]);

  // รอบแรก: จับคู่ด้วย Serial
  const result = plan.map((item) => {
    if (item.status !== "ok") return item;
    const assets = bySerial.get(item.serialNumber) || [];
    if (assets.length === 0) return { ...item, status: "not_found" };
    if (assets.length > 1) return { ...item, status: "ambiguous", assets };
    return withChanges(item, assets[0], overwrite);
  });

  // รอบสอง: ไฟล์ที่จับคู่ไม่ได้ ให้ใช้ Asset ที่ผู้ใช้เลือกเอง
  const taken = new Set(result.filter((item) => item.status === "ready").map((item) => item.asset.id));
  const items = result.map((item, index) => {
    const code = manual.get(index);
    if (!code || !["not_found", "no_serial"].includes(item.status)) return item;
    const asset = byCode.get(code);
    const base = { ...item, manualCode: code, matchStatus: item.status };
    if (!asset) return { ...base, status: "manual_invalid", error: `ไม่พบ Asset รหัส ${code}` };
    // ไฟล์ที่มี Serial ใส่ได้เฉพาะ Asset ที่ Serial ยังว่าง กันจับคู่ผิดเครื่อง
    if (item.status === "not_found" && asset.serial) {
      return { ...base, status: "manual_invalid", error: `${asset.asset_code} มี Serial ${asset.serial_number} อยู่แล้ว ไม่ตรงกับไฟล์นี้` };
    }
    if (taken.has(asset.id)) {
      return { ...base, status: "manual_invalid", error: `${asset.asset_code} ถูกจับคู่กับไฟล์อื่นในชุดนี้แล้ว` };
    }
    taken.add(asset.id);
    return withChanges(item, asset, overwrite, { manualCode: code, matchStatus: item.status });
  });
  return { items, overwrite };
}

function publicItem(item) {
  const { values, asset, ...rest } = item;
  return {
    ...rest,
    asset: asset && { id: asset.id, asset_code: asset.asset_code, asset_name: asset.asset_name, brand: asset.brand, model: asset.model },
    fieldCount: values ? Object.keys(values).length : 0,
    values,
  };
}

// อัปเดต Brand / Model / Serial พร้อมบันทึกประวัติการแก้ไข
async function saveIdentity(client, item, accountId, overwrite) {
  const before = (await client.query(`SELECT ${HISTORY_COLUMNS} FROM public.assets WHERE id=$1 FOR UPDATE`, [item.asset.id])).rows[0];
  if (!before) throw new AssetWorkflowError("ไม่พบ Asset");
  // คำนวณใหม่ใน transaction เผื่อมีคนแก้ Asset ระหว่างตรวจไฟล์กับกดบันทึก
  const changes = changesFor(item, before, overwrite);
  if (item.matchStatus === "not_found" && before.serial_number?.trim()) {
    throw new AssetWorkflowError(`${before.asset_code} มี Serial อยู่แล้ว กรุณาตรวจไฟล์ใหม่`);
  }
  if (changes.serialNumber) {
    const duplicate = await client.query(
      `SELECT asset_code FROM public.assets
       WHERE id<>$1 AND upper(regexp_replace(serial_number, '\\s', '', 'g'))=$2 LIMIT 1`,
      [item.asset.id, changes.serialNumber.to],
    );
    if (duplicate.rowCount) throw new AssetWorkflowError(`Serial นี้ถูกใช้กับ ${duplicate.rows[0].asset_code} แล้ว`);
  }
  if (Object.keys(changes).length === 0) return changes;
  const after = (await client.query(
    `UPDATE public.assets SET
       brand = CASE WHEN $2 THEN $3 ELSE brand END,
       model = CASE WHEN $4 THEN $5 ELSE model END,
       serial_number = CASE WHEN $6 THEN $7 ELSE serial_number END,
       updated_at = NOW()
     WHERE id=$1 RETURNING ${HISTORY_COLUMNS}`,
    [
      item.asset.id,
      Boolean(changes.brand), changes.brand?.to ?? null,
      Boolean(changes.model), changes.model?.to ?? null,
      Boolean(changes.serialNumber), changes.serialNumber?.to ?? null,
    ],
  )).rows[0];
  await recordAssetEdit(client, item.asset.id, accountId, before, after);
  return changes;
}

// POST /api/assets/machine-specs { files, manual?, overwriteBrandModel? } → ตรวจไฟล์และจับคู่ (ยังไม่บันทึก)
export async function POST(request) {
  return assetWorkflowApi(true, async () => {
    const { items } = await buildPlan(request);
    return { items: items.map(publicItem) };
  });
}

// PUT /api/assets/machine-specs { files, manual?, overwriteBrandModel? } → บันทึกเฉพาะไฟล์ที่พร้อม
// ช่อง Technical ที่ไม่มีในไฟล์คงค่าเดิมไว้ · แต่ละเครื่องบันทึกแยก transaction
export async function PUT(request) {
  return assetWorkflowApi(true, async (account) => {
    const { items, overwrite } = await buildPlan(request);
    const results = [];
    for (const item of items) {
      if (item.status !== "ready") {
        results.push(publicItem(item));
        continue;
      }
      const client = await getDbPool().connect();
      try {
        await client.query("BEGIN");
        const changes = await saveIdentity(client, item, account.id, overwrite);
        await mergeAssetTechnical(client, item.asset.id, item.values);
        await client.query("COMMIT");
        results.push({ ...publicItem(item), changes, status: "saved" });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Import machine specs failed", item.asset.id, error);
        // ข้อความจากระบบเป็นภาษาไทยให้ผู้ใช้อ่าน ส่วน error จาก DB ไม่ส่งรายละเอียดออกไป
        results.push({ ...publicItem(item), status: "failed", error: error.code ? "บันทึกไม่สำเร็จ" : error.message || "บันทึกไม่สำเร็จ" });
      } finally {
        client.release();
      }
    }
    return { items: results, saved: results.filter((item) => item.status === "saved").length };
  });
}
