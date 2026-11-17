-- =========================================================
-- Asset Code รูปแบบใหม่: {กลุ่มบริษัท}{ปี 2 หลัก}-{ประเภท}-{เลข 3 หลัก}
--   F1/F2 -> AMZAP  เช่น AMZAP26-NB-001
--   M1    -> MEMO   เช่น MEMO26-NB-001
-- สาขาไม่อยู่ในรหัสแล้ว เพราะเครื่องย้ายสาขาได้ แต่รหัสต้องคงที่
-- registration_site_id ยังเก็บสาขาที่ขึ้นทะเบียนไว้เป็นข้อมูลแยก
--
-- Migration นี้แก้เฉพาะ trigger ที่ตรวจการแก้รหัส ให้ยอมรับรูปแบบใหม่
-- รูปแบบเดิม (F1-NB-001) ยังผ่านได้ เพื่อให้ใช้งานต่อได้ระหว่างเปลี่ยนผ่าน
-- Rerun ได้ (CREATE OR REPLACE)
-- =========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_asset_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_site_id bigint;
  v_site_code varchar(10);
  v_type_prefix varchar(10);
  v_running_number integer;
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

    SELECT prefix INTO v_type_prefix
    FROM public.asset_types
    WHERE id = OLD.asset_type_id;

    IF split_part(NEW.asset_code, '-', 2) <> v_type_prefix THEN
      RAISE EXCEPTION 'Asset code prefix must match Asset Type prefix %', v_type_prefix;
    END IF;

    -- Preserve the previous printed code for search. Callers may set
    -- history_assets explicitly (the code-conversion migration does).
    IF NEW.history_assets IS NULL OR btrim(NEW.history_assets) = '' THEN
      NEW.history_assets := OLD.asset_code;
    END IF;

    IF NEW.asset_code ~ '^(AMZAP|MEMO)[0-9]{2}-[A-Z0-9]{2,10}-[0-9]{3}$' THEN
      -- รูปแบบใหม่: กลุ่มบริษัทต้องตรงกับสาขาที่ขึ้นทะเบียน (สาขาไม่เปลี่ยนตามรหัส)
      SELECT site_code INTO v_site_code
      FROM public.asset_registration_sites
      WHERE id = COALESCE(NEW.registration_site_id, OLD.registration_site_id);

      v_group := CASE WHEN v_site_code = 'M1' THEN 'MEMO'
                      WHEN v_site_code ~ '^F[0-9]{1,3}$' THEN 'AMZAP' END;

      IF v_group IS NULL OR NEW.asset_code !~ ('^' || v_group || '[0-9]{2}-') THEN
        RAISE EXCEPTION 'Asset code group must match registration site % (%)', v_site_code, v_group;
      END IF;

      NEW.asset_code_version := 2;
    ELSIF NEW.asset_code ~ '^(F[0-9]{1,3}|M1)-[A-Z0-9]{2,10}-[0-9]{3}$' THEN
      -- รูปแบบเดิม: คงพฤติกรรมเดิมไว้ทุกอย่าง
      SELECT site.id, site.site_code
      INTO v_site_id, v_site_code
      FROM public.asset_registration_sites site
      WHERE site.site_code = split_part(NEW.asset_code, '-', 1)
        AND site.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration site in Asset code was not found or inactive';
      END IF;

      v_running_number := split_part(NEW.asset_code, '-', 3)::integer;
      NEW.registration_site_id := v_site_id;
      NEW.asset_code_version := 2;

      INSERT INTO public.asset_code_v2_counters (
        registration_site_id,
        asset_type_id,
        last_number
      )
      VALUES (v_site_id, OLD.asset_type_id, v_running_number)
      ON CONFLICT (registration_site_id, asset_type_id) DO UPDATE
      SET last_number = greatest(
        public.asset_code_v2_counters.last_number,
        excluded.last_number
      );
    ELSE
      RAISE EXCEPTION 'Asset code must use AMZAP26-NB-001 or MEMO26-NB-001 format';
    END IF;
  ELSIF NEW.registration_site_id IS DISTINCT FROM OLD.registration_site_id
     OR NEW.asset_code_version IS DISTINCT FROM OLD.asset_code_version
  THEN
    RAISE EXCEPTION
      'Registration site and code version can change only through Asset code';
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
