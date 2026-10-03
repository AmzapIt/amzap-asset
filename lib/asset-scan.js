import { query } from './db.js';
import { formatUserDisplayName } from './user-display.js';

export class AssetWorkflowError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function workflowId(value, optional = false) {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
    throw new AssetWorkflowError('รหัสรายการไม่ถูกต้อง');
  }
  return value;
}

export function normalizeAssetCode(value) {
  if (typeof value !== 'string') throw new AssetWorkflowError('กรุณาระบุ Asset Code');
  const code = value.trim();
  // Existing stickers contain the literal asset code, not a URL. Do not navigate
  // to arbitrary scanned links or execute QR content.
  if (!code || code.length > 100 || /[\s\x00-\x1f<>:/\\?#]/.test(code)) {
    throw new AssetWorkflowError('QR นี้ไม่ใช่ Asset Code กรุณาสแกนสติ๊กเกอร์ Asset หรือกรอกรหัส');
  }
  return code;
}

// Keep the same legacy-holder exclusion as the Asset detail/offboarding pages.
export const assetHolderJoins = `
 LEFT JOIN LATERAL (
   SELECT assigned_to FROM public.asset_assignments
    WHERE asset_id=a.id AND returned_date IS NULL
    ORDER BY assigned_date DESC,id DESC LIMIT 1
 ) assignment ON true
 LEFT JOIN LATERAL (
   SELECT CASE
     WHEN assignment.assigned_to IS NOT NULL THEN assignment.assigned_to
     WHEN a.status='In Use' AND NOT EXISTS (
       SELECT 1 FROM public.asset_assignments h WHERE h.asset_id=a.id
     ) AND NOT EXISTS (
       SELECT 1 FROM public.employee_offboarding_items i
       JOIN public.employee_offboardings o ON o.id=i.offboarding_id
       WHERE i.asset_id=a.id AND i.resolution='not_held' AND o.user_id=a.asset_owner_id
     ) THEN a.asset_owner_id ELSE NULL END AS id
 ) holder ON true
 LEFT JOIN public."user" holder_user ON holder_user.id=holder.id
 LEFT JOIN public.locations location ON location.id=a.location_id`;

export async function lookupAsset(code, db = { query }) {
  const normalized = normalizeAssetCode(code);
  const result = await db.query(`
    SELECT a.id::text,a.asset_code,a.asset_name,a.status,a.brand,a.model,a.serial_number,
      a.location_id::text,location.name AS location_name,t.name AS asset_type,
      holder.id::text AS holder_id,holder_user.full_name,holder_user.nickname,
      CASE WHEN assignment.assigned_to IS NOT NULL THEN 'assignment'
           WHEN holder.id IS NOT NULL THEN 'legacy_owner' ELSE NULL END AS holder_source,
      owner_user.full_name AS owner_full_name,owner_user.nickname AS owner_nickname,
      (SELECT COUNT(*)::int FROM public.asset_documents d
       WHERE d.asset_id=a.id AND d.document_type='Asset Photo') AS photo_count,
      (SELECT jsonb_build_object('file_name',d.file_name,'storage_path',d.storage_path)
       FROM public.asset_documents d WHERE d.asset_id=a.id AND d.document_type='Asset Photo'
       ORDER BY d.is_primary_photo DESC,d.id DESC LIMIT 1) AS photo
    FROM public.assets a ${assetHolderJoins}
    LEFT JOIN public.asset_types t ON t.id=a.asset_type_id
    LEFT JOIN public."user" owner_user ON owner_user.id=a.asset_owner_id
    WHERE lower(a.asset_code)=lower($1) ORDER BY a.id LIMIT 2`, [normalized]);
  if (!result.rows.length) throw new AssetWorkflowError(`ไม่พบ Asset Code: ${normalized}`, 404);
  if (result.rows.length > 1) throw new AssetWorkflowError('รหัสนี้ตรงกับหลาย Asset กรุณาตรวจข้อมูลรหัสก่อน', 409);
  const { full_name, nickname, owner_full_name, owner_nickname, ...asset } = result.rows[0];
  return {
    ...asset,
    holder_name: formatUserDisplayName({ full_name, nickname }) || null,
    owner_name: formatUserDisplayName({ full_name: owner_full_name, nickname: owner_nickname }) || null,
  };
}
