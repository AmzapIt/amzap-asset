BEGIN;

ALTER TABLE public.asset_maintenance
  ADD COLUMN IF NOT EXISTS sent_at date,
  ADD COLUMN IF NOT EXISTS sent_to text,
  ADD COLUMN IF NOT EXISTS expected_return_at date;

COMMIT;
