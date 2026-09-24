-- กำหนด Location หลักให้ใช้ ID คงที่:
--   1 = Amzap โรงงาน 1 (เดิม ID 9)
--   2 = Amzap โรงงาน 2 (เดิม ID 7)
-- อัปเดต Foreign Key ใน assets, asset_assignments และ public."user"
-- ภายใน Transaction เดียว และยกเลิกก่อนแก้ข้อมูลหาก ID เป้าหมายเป็น Location อื่น
-- สามารถรันซ้ำได้: เมื่อย้ายข้อมูลแล้ว คำสั่งรอบถัดไปจะไม่เปลี่ยนข้อมูลเพิ่ม
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = 1 AND name <> 'Amzap โรงงาน 1'
  ) THEN
    RAISE EXCEPTION 'Location ID 1 is already used by another location';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = 2 AND name <> 'Amzap โรงงาน 2'
  ) THEN
    RAISE EXCEPTION 'Location ID 2 is already used by another location';
  END IF;
END $$;

INSERT INTO public.locations (
  id, name, building, floor, room, description, created_at, is_active
)
SELECT
  1, name, building, floor, room, description, created_at, is_active
FROM public.locations
WHERE id = 9 AND name = 'Amzap โรงงาน 1'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (
  id, name, building, floor, room, description, created_at, is_active
)
SELECT
  2, name, building, floor, room, description, created_at, is_active
FROM public.locations
WHERE id = 7 AND name = 'Amzap โรงงาน 2'
ON CONFLICT (id) DO NOTHING;

UPDATE public.assets
SET location_id = 1
WHERE location_id = 9;

UPDATE public.assets
SET location_id = 2
WHERE location_id = 7;

UPDATE public.asset_assignments
SET location_id = 1
WHERE location_id = 9;

UPDATE public.asset_assignments
SET location_id = 2
WHERE location_id = 7;

UPDATE public."user"
SET location_id = 1
WHERE location_id = 9;

UPDATE public."user"
SET location_id = 2
WHERE location_id = 7;

DELETE FROM public.locations
WHERE (id = 9 AND name = 'Amzap โรงงาน 1')
   OR (id = 7 AND name = 'Amzap โรงงาน 2');

COMMIT;
