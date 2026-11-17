-- =========================================================
-- แปลงรหัส Asset เดิมทั้งหมดเป็นรูปแบบใหม่ (ต้องรัน 032 ก่อน)
--   F1/F2-NB-054 -> AMZAP26-NB-054   (เลขรันเดิม)
--   M1-NB-001    -> MEMO26-NB-001    (เลขรันเดิม)
-- history_assets เก็บรหัส F1/F2/M1 เดิมแทนรหัสรุ่นแรก (เช่น MON-AMZ26-016)
-- เพื่อให้ค้นหาได้ 2 แบบ: รหัสใหม่ + รหัสก่อนหน้า
--
-- สำรองค่าเดิมไว้ใน asset_code_backup_033 ใช้ย้อนกลับได้ด้วย:
--   UPDATE public.assets a SET asset_code=b.asset_code, history_assets=b.history_assets
--     FROM public.asset_code_backup_033 b WHERE b.id=a.id;
-- (ย้อนกลับต้องทำหลังจากที่ trigger 032 ยังอยู่ เพราะรองรับทั้งสองรูปแบบ)
-- Rerun ได้: แปลงเฉพาะแถวที่ยังเป็นรูปแบบเดิม
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_code_backup_033 (
  id bigint PRIMARY KEY,
  asset_code varchar(100) NOT NULL,
  history_assets varchar(100),
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.asset_code_backup_033 (id, asset_code, history_assets)
SELECT id, asset_code, history_assets
FROM public.assets
WHERE asset_code ~ '^(F[0-9]{1,3}|M1)-[A-Z0-9]{2,10}-[0-9]{3}$'
ON CONFLICT (id) DO NOTHING;

-- หยุดถ้ารหัสใหม่จะชนกัน (กันข้อมูลเปลี่ยนไปหลังตรวจไฟล์ Excel)
DO $$
DECLARE v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT CASE WHEN asset_code ~ '^M1-' THEN 'MEMO26' ELSE 'AMZAP26' END
           || '-' || split_part(asset_code, '-', 2) || '-' || split_part(asset_code, '-', 3) AS new_code
    FROM public.assets
    WHERE asset_code ~ '^(F[0-9]{1,3}|M1)-[A-Z0-9]{2,10}-[0-9]{3}$'
    UNION ALL
    SELECT asset_code FROM public.assets
    WHERE asset_code ~ '^(AMZAP|MEMO)[0-9]{2}-'
  ) codes
  GROUP BY new_code HAVING count(*) > 1;
  IF v_dupes IS NOT NULL THEN
    RAISE EXCEPTION 'New asset codes would collide; conversion aborted';
  END IF;
END $$;

UPDATE public.assets
SET history_assets = asset_code,
    asset_code = CASE WHEN asset_code ~ '^M1-' THEN 'MEMO26' ELSE 'AMZAP26' END
                 || '-' || split_part(asset_code, '-', 2)
                 || '-' || split_part(asset_code, '-', 3)
WHERE asset_code ~ '^(F[0-9]{1,3}|M1)-[A-Z0-9]{2,10}-[0-9]{3}$';

COMMIT;
