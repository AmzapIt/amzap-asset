-- Add Memorize as an immutable registration site. Existing Asset codes stay unchanged.
-- Safe to rerun on databases using either the original site/type counter or
-- the later shared Asset Type counter.

BEGIN;

ALTER TABLE public.asset_registration_sites
  DROP CONSTRAINT IF EXISTS chk_asset_registration_site_code;

ALTER TABLE public.asset_registration_sites
  ADD CONSTRAINT chk_asset_registration_site_code
  CHECK (site_code ~ '^(F[0-9]{1,3}|M1)$');

-- Preserve the installed version of each trigger function. Replacing only the
-- site-code pattern avoids downgrading databases that already use shared counters.
DO $$
DECLARE
  function_name text;
  installed_function regprocedure;
  function_sql text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'protect_asset_identity',
    'validate_asset_type_running_number'
  ] LOOP
    installed_function := to_regprocedure(
      format('public.%I()', function_name)
    );
    IF installed_function IS NULL THEN
      IF function_name = 'protect_asset_identity' THEN
        RAISE EXCEPTION 'Required Asset identity trigger function is missing';
      END IF;
      CONTINUE;
    END IF;

    SELECT pg_get_functiondef(installed_function::oid) INTO function_sql;
    IF position('^(F[0-9]{1,3}|M1)-' IN function_sql) > 0 THEN
      CONTINUE;
    END IF;
    IF position('^F[0-9]{1,3}-' IN function_sql) = 0 THEN
      RAISE EXCEPTION 'Unexpected Asset code validation in %', function_name;
    END IF;

    EXECUTE replace(
      function_sql,
      '^F[0-9]{1,3}-',
      '^(F[0-9]{1,3}|M1)-'
    );
  END LOOP;
END;
$$;

INSERT INTO public.asset_registration_sites (site_code, name, is_active)
VALUES ('M1', 'Memorize', true)
ON CONFLICT (site_code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true;

COMMIT;
