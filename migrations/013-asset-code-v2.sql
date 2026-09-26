-- =========================================================
-- Asset Code V2 foundation
--
-- New format: F1-NB-001
--   F1 = immutable registration site
--   NB = Asset Type prefix
--   001 = running number scoped by registration site + type
--
-- This migration is safe to rerun. It creates the new schema and infers the
-- registration site of existing assets from the strongest available source:
-- assets.location_id -> active assignment -> current holder/owner location.
-- It DOES NOT rename existing assets yet. Migration 014 performs that final
-- step only after every existing asset has a confirmed F1/F2 site.
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_registration_sites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_code varchar(10) NOT NULL UNIQUE,
  name varchar(150) NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_asset_registration_site_code
    CHECK (site_code ~ '^F[0-9]{1,3}$')
);

INSERT INTO public.asset_registration_sites (site_code, name)
VALUES
  ('F1', 'Amzap โรงงาน 1'),
  ('F2', 'Amzap โรงงาน 2')
ON CONFLICT (site_code) DO UPDATE
SET name = EXCLUDED.name;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS registration_site_id bigint;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_registration_site_id_fkey;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_registration_site_id_fkey
  FOREIGN KEY (registration_site_id)
  REFERENCES public.asset_registration_sites(id);

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS asset_code_version smallint NOT NULL DEFAULT 1;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS chk_asset_code_version;

ALTER TABLE public.assets
  ADD CONSTRAINT chk_asset_code_version
  CHECK (asset_code_version IN (1, 2));

CREATE INDEX IF NOT EXISTS idx_assets_registration_site_id
ON public.assets(registration_site_id);

CREATE TABLE IF NOT EXISTS public.asset_code_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  asset_code varchar(100) NOT NULL,
  code_version smallint NOT NULL DEFAULT 1 CHECK (code_version IN (1, 2)),
  valid_from timestamptz,
  valid_to timestamptz NOT NULL DEFAULT now(),
  change_reason varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_code_history_asset_code_key UNIQUE (asset_code),
  CONSTRAINT asset_code_history_asset_id_code_key UNIQUE (asset_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_asset_code_history_asset_id
ON public.asset_code_history(asset_id, id DESC);

CREATE TABLE IF NOT EXISTS public.asset_code_v2_counters (
  registration_site_id bigint NOT NULL
    REFERENCES public.asset_registration_sites(id),
  asset_type_id bigint NOT NULL REFERENCES public.asset_types(id),
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 999),
  PRIMARY KEY (registration_site_id, asset_type_id)
);

-- Match F1/F2 by location name instead of assuming the generated Site IDs are
-- 1 and 2. Location IDs 1/2 are still used only to identify the current data.
WITH resolved_sites AS (
  SELECT
    a.id AS asset_id,
    CASE COALESCE(a.location_id, current_assignment.location_id, holder.location_id)
      WHEN 1 THEN 'F1'
      WHEN 2 THEN 'F2'
      ELSE NULL
    END AS site_code
  FROM public.assets a
  LEFT JOIN LATERAL (
    SELECT aa.assigned_to, aa.location_id
    FROM public.asset_assignments aa
    WHERE aa.asset_id = a.id
      AND aa.returned_date IS NULL
    ORDER BY aa.assigned_date DESC, aa.id DESC
    LIMIT 1
  ) current_assignment ON true
  LEFT JOIN public."user" holder
    ON holder.id = COALESCE(current_assignment.assigned_to, a.asset_owner_id)
)
UPDATE public.assets a
SET registration_site_id = site.id
FROM resolved_sites resolved
JOIN public.asset_registration_sites site
  ON site.site_code = resolved.site_code
WHERE a.id = resolved.asset_id
  AND a.registration_site_id IS NULL;

-- Future inserts use V2 unless a migration explicitly marks an old row as V1.
ALTER TABLE public.assets
  ALTER COLUMN asset_code_version SET DEFAULT 2;

CREATE OR REPLACE FUNCTION public.generate_asset_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_code varchar(10);
  v_prefix varchar(10);
  v_next integer;
BEGIN
  -- Explicit codes remain temporarily compatible with the previous deployed
  -- Add form. Mark them V1 when no registration site was supplied. The V2
  -- application never sends asset_code and always follows the branch below.
  IF NEW.asset_code IS NOT NULL AND btrim(NEW.asset_code) <> '' THEN
    IF NEW.registration_site_id IS NULL THEN
      NEW.asset_code_version := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.registration_site_id IS NULL THEN
    RAISE EXCEPTION 'Registration site is required';
  END IF;

  SELECT site_code INTO v_site_code
  FROM public.asset_registration_sites
  WHERE id = NEW.registration_site_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration site % not found or inactive', NEW.registration_site_id;
  END IF;

  SELECT prefix INTO v_prefix
  FROM public.asset_types
  WHERE id = NEW.asset_type_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset type % not found or inactive', NEW.asset_type_id;
  END IF;

  INSERT INTO public.asset_code_v2_counters (
    registration_site_id,
    asset_type_id,
    last_number
  )
  VALUES (NEW.registration_site_id, NEW.asset_type_id, 0)
  ON CONFLICT (registration_site_id, asset_type_id) DO NOTHING;

  UPDATE public.asset_code_v2_counters
  SET last_number = last_number + 1
  WHERE registration_site_id = NEW.registration_site_id
    AND asset_type_id = NEW.asset_type_id
    AND last_number < 999
  RETURNING last_number INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Asset code sequence exceeded 999';
  END IF;

  NEW.asset_code := v_site_code || '-' || v_prefix || '-' || lpad(v_next::text, 3, '0');
  NEW.asset_code_version := 2;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_asset_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.asset_code IS DISTINCT FROM OLD.asset_code
     OR NEW.asset_type_id IS DISTINCT FROM OLD.asset_type_id
     OR NEW.asset_code_year IS DISTINCT FROM OLD.asset_code_year
     OR NEW.registration_site_id IS DISTINCT FROM OLD.registration_site_id
     OR NEW.asset_code_version IS DISTINCT FROM OLD.asset_code_version
  THEN
    RAISE EXCEPTION
      'Asset code, type, registration site and code version cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
