-- =========================================================
-- Store the original printed Asset Code directly on assets.
--
-- history_assets keeps the code that is already attached to the physical
-- device. asset_code remains populated until an administrator replaces it
-- with the new F1-NB-001 format in PostgreSQL.
-- =========================================================

BEGIN;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS history_assets varchar(100);

-- If the earlier history table ever received a row, prefer its oldest code.
-- Dynamic SQL keeps this migration rerunnable after the table is removed.
DO $$
BEGIN
  IF to_regclass('public.asset_code_history') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.assets asset
      SET history_assets = history.asset_code
      FROM (
        SELECT DISTINCT ON (asset_id) asset_id, asset_code
        FROM public.asset_code_history
        ORDER BY asset_id, id
      ) history
      WHERE history.asset_id = asset.id
        AND asset.history_assets IS NULL
    $sql$;
  END IF;
END;
$$;

-- Current asset_code is still the code printed on every existing device.
-- Never overwrite a value already preserved by a previous run.
UPDATE public.assets
SET history_assets = asset_code
WHERE history_assets IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_history_assets
ON public.assets(history_assets);

-- The single requested field is now the source of truth for the original
-- code. The unused table would duplicate the same information.
DROP TABLE IF EXISTS public.asset_code_history;

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
  -- Type and legacy code-year remain immutable through normal updates.
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

    -- Preserve the first/original printed code. Subsequent corrections to the
    -- new code must never overwrite this comparison value.
    IF NEW.history_assets IS NULL OR btrim(NEW.history_assets) = '' THEN
      NEW.history_assets := OLD.asset_code;
    END IF;

    NEW.registration_site_id := v_site_id;
    NEW.asset_code_version := 2;

    -- A direct SQL update must keep the same counter used by the Add API.
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
  ELSIF NEW.registration_site_id IS DISTINCT FROM OLD.registration_site_id
     OR NEW.asset_code_version IS DISTINCT FROM OLD.asset_code_version
  THEN
    RAISE EXCEPTION
      'Registration site and code version can change only through Asset code';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.assets.history_assets IS
  'Original Asset Code retained for label comparison and legacy search';

COMMIT;
