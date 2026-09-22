BEGIN;

-- Replaced by lib/asset-report.js, which applies the current-holder rules.
DROP VIEW IF EXISTS public.v_asset_list;

-- All assets now reference public."user" through asset_owner_id.
ALTER TABLE public.assets
  DROP COLUMN IF EXISTS asset_owner_name;

-- is_active is the single employee activity flag.
ALTER TABLE public."user"
  DROP COLUMN IF EXISTS status;

COMMIT;
