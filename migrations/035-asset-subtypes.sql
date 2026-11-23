-- =========================================================
-- 035 จัดประเภท Asset ให้เหลือ 10 ประเภทหลัก + เพิ่มประเภทย่อย (subtype)
--
-- ประเภทที่เปิดใช้: NB, MON, PC, PRN, MOB, NET, CCTV, SW, AP, OTH
--   - เพิ่ม OTH (ชื่อ Other) · เปิด SW อีกครั้ง
--   - ปิด TV (ยังไม่มีเครื่อง) และ LIC (ย้าย 2 รายการไป OTH)
--   - FW, NAS, UPS ปิดอยู่แล้ว ไม่แตะ · ชื่อประเภทคงเดิม · เลขรันไม่เปลี่ยน
-- ประเภทย่อยไม่อยู่ในรหัส Asset เปลี่ยนภายหลังได้โดยรหัสไม่เปลี่ยน
--
-- LIC -> OTH: รหัส AMZAPyy-LIC-nnn เปลี่ยนเป็น AMZAPyy-OTH-nnn (เลขเดิม)
--   รหัสเดิมต่อท้ายใน history_assets ด้วย " | " เหมือนการแก้ประเภทครั้งก่อน
--   และบันทึก asset_audit_logs action CORRECT_ASSET_TYPE
--   ปิด trigger protect_asset_identity เฉพาะช่วงย้าย เพราะปกติห้ามเปลี่ยนประเภท
--
-- Rerun ได้: ตาราง/คอลัมน์ใช้ IF NOT EXISTS, รายการเริ่มต้นใช้ ON CONFLICT DO NOTHING,
-- การย้าย LIC ทำเฉพาะแถวที่ยังเป็น LIC
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_subtypes (
  id bigserial PRIMARY KEY,
  asset_type_id bigint NOT NULL REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL CHECK (btrim(name) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ชื่อห้ามซ้ำในประเภทเดียวกัน (ไม่สนตัวพิมพ์เล็กใหญ่)
CREATE UNIQUE INDEX IF NOT EXISTS asset_subtypes_type_name_key
  ON public.asset_subtypes (asset_type_id, lower(btrim(name)));

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS subtype_id bigint REFERENCES public.asset_subtypes(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_assets_subtype_id ON public.assets (subtype_id);

-- ประเภทย่อยต้องอยู่ในประเภทหลักเดียวกับ Asset (กันข้อมูลผิดจาก SQL ตรง)
CREATE OR REPLACE FUNCTION public.check_asset_subtype()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.subtype_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.asset_subtypes
    WHERE id = NEW.subtype_id AND asset_type_id = NEW.asset_type_id
  ) THEN
    RAISE EXCEPTION 'Asset subtype must belong to the Asset Type';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_asset_subtype ON public.assets;
CREATE TRIGGER trg_check_asset_subtype
  BEFORE INSERT OR UPDATE OF subtype_id, asset_type_id ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.check_asset_subtype();

-- ประเภท OTH ยังไม่มีในระบบ
INSERT INTO public.asset_types (name, prefix, is_active)
VALUES ('Other', 'OTH', true)
ON CONFLICT DO NOTHING;

-- ประเภทย่อยเริ่มต้น
INSERT INTO public.asset_subtypes (asset_type_id, name, sort_order)
SELECT t.id, s.name, s.sort_order
FROM (VALUES
  ('NET', 'Router', 1), ('NET', 'Firewall', 2), ('NET', 'Controller', 3), ('NET', 'Server', 4),
  ('NET', 'NAS', 5), ('NET', 'UPS', 6), ('NET', 'Rack', 7),
  ('CCTV', 'IP Camera', 1), ('CCTV', 'NVR', 2),
  ('SW', 'PoE', 1), ('SW', 'Non-PoE', 2),
  ('MOB', 'Phone', 1), ('MOB', 'Tablet', 2),
  ('PRN', 'Printer', 1), ('PRN', 'Sticker Printer', 2),
  ('OTH', 'License', 1), ('OTH', 'TV', 2), ('OTH', 'Projector', 3), ('OTH', 'IP Phone', 4),
  ('OTH', 'Fingerprint Scanner', 5), ('OTH', 'HDD', 6)
) AS s(prefix, name, sort_order)
JOIN public.asset_types t ON t.prefix = s.prefix
ON CONFLICT DO NOTHING;

-- ย้าย LIC -> OTH (subtype License)
DO $$
DECLARE
  v_lic bigint;
  v_oth bigint;
  v_lic_name text;
  v_oth_name text;
  v_license bigint;
  r record;
  v_new_code text;
BEGIN
  SELECT id, name INTO v_lic, v_lic_name FROM public.asset_types WHERE prefix = 'LIC';
  SELECT id, name INTO v_oth, v_oth_name FROM public.asset_types WHERE prefix = 'OTH';
  IF v_oth IS NULL THEN
    RAISE EXCEPTION 'Asset Type OTH was not found';
  END IF;
  SELECT id INTO v_license FROM public.asset_subtypes
  WHERE asset_type_id = v_oth AND lower(name) = 'license';

  IF v_lic IS NOT NULL AND EXISTS (SELECT 1 FROM public.assets WHERE asset_type_id = v_lic) THEN
    ALTER TABLE public.assets DISABLE TRIGGER trg_protect_asset_identity;

    FOR r IN
      SELECT a.id, a.asset_code, a.history_assets
      FROM public.assets a WHERE a.asset_type_id = v_lic ORDER BY a.id
    LOOP
      v_new_code := regexp_replace(r.asset_code, '-LIC-', '-OTH-');
      IF EXISTS (SELECT 1 FROM public.assets WHERE asset_code = v_new_code) THEN
        RAISE EXCEPTION 'Asset code % already exists', v_new_code;
      END IF;

      UPDATE public.assets
      SET asset_type_id = v_oth,
          subtype_id = v_license,
          asset_code = v_new_code,
          history_assets = CASE WHEN nullif(btrim(history_assets), '') IS NULL THEN r.asset_code
                                ELSE history_assets || ' | ' || r.asset_code END
      WHERE id = r.id;

      INSERT INTO public.asset_audit_logs
        (asset_id, record_id, table_name, action, old_values, new_values)
      VALUES (r.id, r.id, 'assets', 'CORRECT_ASSET_TYPE',
        jsonb_build_object('asset_code', r.asset_code, 'asset_type', v_lic_name,
          'asset_type_id', v_lic::text, 'history_assets', r.history_assets),
        jsonb_build_object('asset_code', v_new_code, 'asset_type', v_oth_name,
          'asset_type_id', v_oth::text, 'subtype', 'License',
          'history_assets', (SELECT history_assets FROM public.assets WHERE id = r.id),
          'reason', 'รวมประเภท LIC เข้า OTH (migration 035)'));
    END LOOP;

    ALTER TABLE public.assets ENABLE TRIGGER trg_protect_asset_identity;
  END IF;
END $$;

-- เปิด/ปิดประเภท
UPDATE public.asset_types SET is_active = true WHERE prefix = 'SW';
UPDATE public.asset_types SET is_active = false WHERE prefix IN ('TV', 'LIC');

COMMIT;
