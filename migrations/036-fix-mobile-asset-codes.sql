-- =========================================================
-- 036 แก้รหัส Asset ประเภท MOB ที่ยังใช้ตัวย่อเดิม MOBILE
--   AMZAP26-MOBILE-001 -> AMZAP26-MOB-001 (เลขเดิม)
--
-- รหัสเหล่านี้มาจาก F1-MOBILE-xxx ที่แปลงใน 033 โดยคงส่วนกลางไว้
-- แต่ตัวย่อของประเภทเป็น MOB ทำให้ระบบหาเลขรันถัดไปไม่เจอ (จะเสนอ 001 ซ้ำ)
--
-- รหัสเดิมต่อท้าย history_assets ด้วย " | " และบันทึก asset_audit_logs
-- action CORRECT_ASSET_CODE · trigger protect_asset_identity ยังทำงานตามปกติ
-- (ประเภทไม่เปลี่ยน และรหัสใหม่ผ่านกติกาเดิม)
-- Rerun ได้: แก้เฉพาะแถวที่ยังเป็น -MOBILE-
-- =========================================================

BEGIN;

DO $$
DECLARE
  r record;
  v_new_code text;
BEGIN
  FOR r IN
    SELECT a.id, a.asset_code, a.history_assets
    FROM public.assets a
    JOIN public.asset_types t ON t.id = a.asset_type_id
    WHERE t.prefix = 'MOB' AND split_part(a.asset_code, '-', 2) = 'MOBILE'
    ORDER BY a.id
  LOOP
    v_new_code := regexp_replace(r.asset_code, '-MOBILE-', '-MOB-');
    IF EXISTS (SELECT 1 FROM public.assets WHERE asset_code = v_new_code) THEN
      RAISE EXCEPTION 'Asset code % already exists', v_new_code;
    END IF;

    UPDATE public.assets
    SET asset_code = v_new_code,
        history_assets = CASE WHEN nullif(btrim(history_assets), '') IS NULL THEN r.asset_code
                              ELSE history_assets || ' | ' || r.asset_code END
    WHERE id = r.id;

    INSERT INTO public.asset_audit_logs
      (asset_id, record_id, table_name, action, old_values, new_values)
    VALUES (r.id, r.id, 'assets', 'CORRECT_ASSET_CODE',
      jsonb_build_object('asset_code', r.asset_code, 'history_assets', r.history_assets),
      jsonb_build_object('asset_code', v_new_code,
        'history_assets', (SELECT history_assets FROM public.assets WHERE id = r.id),
        'reason', 'แก้ตัวย่อในรหัสให้ตรงกับประเภท MOB (migration 036)'));
  END LOOP;
END $$;

COMMIT;
