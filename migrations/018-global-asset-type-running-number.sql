-- =========================================================
-- One running-number sequence per Asset Type across all sites
--
-- Example: F1-NB-019 is followed by F2-NB-020. F1/F2 remains the
-- immutable registration site, while NB owns the shared sequence.
--
-- Existing codes are never renamed. Historical duplicate suffixes remain
-- valid, but every new or changed V2 code is blocked from reusing a suffix
-- that already exists for the same Asset Type.
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_code_type_counters (
  asset_type_id bigint PRIMARY KEY REFERENCES public.asset_types(id),
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 999)
);

-- Start each shared counter at the highest suffix already present in F1/F2.
-- ON CONFLICT makes this migration safe to rerun without moving backwards.
INSERT INTO public.asset_code_type_counters (asset_type_id, last_number)
SELECT
  asset.asset_type_id,
  max(right(asset.asset_code, 3)::integer)
FROM public.assets asset
WHERE asset.asset_code ~ '^F[0-9]{1,3}-[A-Z0-9]{2,10}-[0-9]{3}$'
GROUP BY asset.asset_type_id
ON CONFLICT (asset_type_id) DO UPDATE
SET last_number = greatest(
  public.asset_code_type_counters.last_number,
  excluded.last_number
);

-- This function also supports direct SQL inserts that omit asset_code.
-- The generated suffix comes from the Asset Type counter, not the Site.
CREATE OR REPLACE FUNCTION public.generate_asset_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_code varchar(10);
  v_prefix varchar(10);
  v_next integer;
BEGIN
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

  INSERT INTO public.asset_code_type_counters (asset_type_id, last_number)
  VALUES (NEW.asset_type_id, 0)
  ON CONFLICT (asset_type_id) DO NOTHING;

  UPDATE public.asset_code_type_counters
  SET last_number = last_number + 1
  WHERE asset_type_id = NEW.asset_type_id
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

-- Database-level protection covers the application and direct SQL writes.
-- A trigger is used instead of a unique index because existing duplicate
-- suffixes are intentionally retained and must not block this migration.
CREATE OR REPLACE FUNCTION public.validate_asset_type_running_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_running_number integer;
BEGIN
  IF NEW.asset_code IS NULL
     OR NEW.asset_code !~ '^F[0-9]{1,3}-[A-Z0-9]{2,10}-[0-9]{3}$'
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.asset_code IS NOT DISTINCT FROM OLD.asset_code
     AND NEW.asset_type_id IS NOT DISTINCT FROM OLD.asset_type_id
  THEN
    RETURN NEW;
  END IF;

  v_running_number := right(NEW.asset_code, 3)::integer;

  IF EXISTS (
    SELECT 1
    FROM public.assets existing
    WHERE existing.asset_type_id = NEW.asset_type_id
      AND existing.asset_code ~ '^F[0-9]{1,3}-[A-Z0-9]{2,10}-[0-9]{3}$'
      AND right(existing.asset_code, 3) = lpad(v_running_number::text, 3, '0')
      AND (TG_OP = 'INSERT' OR existing.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      CONSTRAINT = 'assets_asset_type_running_number_key',
      MESSAGE = 'Asset Type running number already exists';
  END IF;

  INSERT INTO public.asset_code_type_counters (asset_type_id, last_number)
  VALUES (NEW.asset_type_id, v_running_number)
  ON CONFLICT (asset_type_id) DO UPDATE
  SET last_number = greatest(
    public.asset_code_type_counters.last_number,
    excluded.last_number
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_asset_running_number ON public.assets;
CREATE TRIGGER trg_validate_asset_running_number
BEFORE INSERT OR UPDATE OF asset_code, asset_type_id ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.validate_asset_type_running_number();

-- Keep direct Asset Code corrections synchronized with the shared counter.
CREATE OR REPLACE FUNCTION public.protect_asset_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id bigint;
  v_site_code varchar(10);
  v_type_prefix varchar(10);
  v_running_number integer;
BEGIN
  IF NEW.asset_type_id IS DISTINCT FROM OLD.asset_type_id
     OR NEW.asset_code_year IS DISTINCT FROM OLD.asset_code_year
  THEN
    RAISE EXCEPTION 'Asset type and legacy code year cannot be changed';
  END IF;

  IF NEW.asset_code IS DISTINCT FROM OLD.asset_code THEN
    NEW.asset_code := upper(btrim(NEW.asset_code));

    IF NEW.asset_code !~ '^F[0-9]{1,3}-[A-Z0-9]{2,10}-[0-9]{3}$' THEN
      RAISE EXCEPTION 'Asset code must use F1-NB-001 format';
    END IF;

    SELECT site.id, site.site_code, asset_type.prefix
    INTO v_site_id, v_site_code, v_type_prefix
    FROM public.asset_registration_sites site
    JOIN public.asset_types asset_type
      ON asset_type.id = OLD.asset_type_id
    WHERE site.site_code = split_part(NEW.asset_code, '-', 1)
      AND site.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Registration site in Asset code was not found or inactive';
    END IF;

    IF split_part(NEW.asset_code, '-', 2) <> v_type_prefix THEN
      RAISE EXCEPTION 'Asset code prefix must match Asset Type prefix %', v_type_prefix;
    END IF;

    v_running_number := split_part(NEW.asset_code, '-', 3)::integer;

    IF NEW.history_assets IS NULL OR btrim(NEW.history_assets) = '' THEN
      NEW.history_assets := OLD.asset_code;
    END IF;

    NEW.registration_site_id := v_site_id;
    NEW.asset_code_version := 2;

    INSERT INTO public.asset_code_type_counters (asset_type_id, last_number)
    VALUES (OLD.asset_type_id, v_running_number)
    ON CONFLICT (asset_type_id) DO UPDATE
    SET last_number = greatest(
      public.asset_code_type_counters.last_number,
      excluded.last_number
    );
  ELSIF NEW.registration_site_id IS DISTINCT FROM OLD.registration_site_id
     OR NEW.asset_code_version IS DISTINCT FROM OLD.asset_code_version
  THEN
    RAISE EXCEPTION
      'Registration site and code version can change only through Asset code';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.asset_code_type_counters IS
  'Highest shared Asset Code suffix for each Asset Type across all registration sites';

-- The old counter split the sequence by registration site and is no longer
-- referenced after both database functions above have been replaced.
DROP TABLE IF EXISTS public.asset_code_v2_counters;

COMMIT;
