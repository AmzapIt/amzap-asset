-- =========================================================
-- ลบของเก่าที่ไม่ได้ใช้แล้ว หลังแปลงรหัสเป็น AMZAP26/MEMO26 (033)
--   - trigger/function generate_asset_code (แอปส่งรหัสเองเสมอ ไม่เคยใช้ทางนี้)
--   - ตารางตัวนับ asset_code_counters, asset_code_v2_counters
--     (เลขรันหาเองจากรหัสใน assets; ไม่มีโค้ดอ่านตารางนี้)
--   - protect_asset_identity ไม่ยอมรับรูปแบบ F1-NB-001 อีก
-- ต้องรันหลัง 032 และ 033 · Rerun ได้
-- ตาราง asset_code_backup_033 ยังเก็บไว้สำหรับย้อนกลับรหัส
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.assets
    WHERE asset_code !~ '^(AMZAP|MEMO)[0-9]{2}-[A-Z0-9]{2,10}-[0-9]{3}$'
  ) THEN
    RAISE EXCEPTION 'Some assets still use the old code format; run 033 first';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_generate_asset_code ON public.assets;
DROP FUNCTION IF EXISTS public.generate_asset_code();

CREATE OR REPLACE FUNCTION public.protect_asset_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_site_code varchar(10);
  v_type_prefix varchar(10);
  v_group text;
BEGIN
  -- Type and legacy code-year remain immutable through normal updates.
  IF NEW.asset_type_id IS DISTINCT FROM OLD.asset_type_id
     OR NEW.asset_code_year IS DISTINCT FROM OLD.asset_code_year
  THEN
    RAISE EXCEPTION 'Asset type and legacy code year cannot be changed';
  END IF;

  IF NEW.asset_code IS DISTINCT FROM OLD.asset_code THEN
    NEW.asset_code := upper(btrim(NEW.asset_code));

    IF NEW.asset_code !~ '^(AMZAP|MEMO)[0-9]{2}-[A-Z0-9]{2,10}-[0-9]{3}$' THEN
      RAISE EXCEPTION 'Asset code must use AMZAP26-NB-001 or MEMO26-NB-001 format';
    END IF;

    SELECT prefix INTO v_type_prefix
    FROM public.asset_types
    WHERE id = OLD.asset_type_id;

    IF split_part(NEW.asset_code, '-', 2) <> v_type_prefix THEN
      RAISE EXCEPTION 'Asset code prefix must match Asset Type prefix %', v_type_prefix;
    END IF;

    -- กลุ่มบริษัทในรหัสต้องตรงกับสาขาที่ขึ้นทะเบียน: F* = AMZAP, M1 = MEMO
    SELECT site_code INTO v_site_code
    FROM public.asset_registration_sites
    WHERE id = COALESCE(NEW.registration_site_id, OLD.registration_site_id);

    v_group := CASE WHEN v_site_code = 'M1' THEN 'MEMO'
                    WHEN v_site_code ~ '^F[0-9]{1,3}$' THEN 'AMZAP' END;

    IF v_group IS NULL OR NEW.asset_code !~ ('^' || v_group || '[0-9]{2}-') THEN
      RAISE EXCEPTION 'Asset code group must match registration site % (%)', v_site_code, v_group;
    END IF;

    -- เก็บรหัสก่อนหน้าไว้ค้นหา (ถ้ายังไม่มี)
    IF NEW.history_assets IS NULL OR btrim(NEW.history_assets) = '' THEN
      NEW.history_assets := OLD.asset_code;
    END IF;

    NEW.asset_code_version := 2;
  ELSIF NEW.registration_site_id IS DISTINCT FROM OLD.registration_site_id
     OR NEW.asset_code_version IS DISTINCT FROM OLD.asset_code_version
  THEN
    RAISE EXCEPTION
      'Registration site and code version can change only through Asset code';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TABLE IF EXISTS public.asset_code_counters;
DROP TABLE IF EXISTS public.asset_code_v2_counters;

COMMIT;
