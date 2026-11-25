-- =========================================================
-- 037 วันเวลาที่นำเข้าสเปกจากสคริปต์ตรวจเครื่องล่าสุด
--   NULL = ยังไม่เคยนำเข้า · การพิมพ์แก้เองไม่เปลี่ยนค่านี้
--
-- ข้อมูลเดิม: เครื่อง NB/PC ที่มี Windows Activation (น่าจะมาจากสคริปต์)
--   ใช้วันที่แก้ Technical ล่าสุดเป็นวันที่โดยประมาณ ทำครั้งเดียวตอนเพิ่มคอลัมน์
-- Rerun ได้: ถ้ามีคอลัมน์แล้วจะไม่ทำอะไร
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'specs_imported_at'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN specs_imported_at timestamptz;

    -- ไม่ให้ updated_at ของ Asset เปลี่ยนจากการเติมข้อมูลเดิม
    ALTER TABLE public.assets DISABLE TRIGGER trg_assets_updated_at;
    UPDATE public.assets a
    SET specs_imported_at = x.updated_at
    FROM public.asset_technical x, public.asset_types t
    WHERE x.asset_id = a.id AND t.id = a.asset_type_id
      AND t.prefix IN ('NB', 'PC')
      AND nullif(btrim(x.extra_specs->>'windowsActivation'), '') IS NOT NULL;
    ALTER TABLE public.assets ENABLE TRIGGER trg_assets_updated_at;
  END IF;
END $$;

COMMIT;
