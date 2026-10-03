BEGIN;

-- Additive history fields: older events keep their original, possibly unknown actor.
ALTER TABLE public.asset_audit_logs
  ADD COLUMN IF NOT EXISTS changed_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.asset_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.asset_maintenance
  ADD COLUMN IF NOT EXISTS recorded_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.asset_count_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 150),
  location_id bigint REFERENCES public.locations(id) ON DELETE RESTRICT,
  asset_type_id bigint REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  location_name text,
  asset_type_name text,
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  closed_at timestamptz,
  CHECK ((status='open' AND closed_at IS NULL) OR (status='closed' AND closed_at IS NOT NULL))
);

-- Freeze the expected inventory when a round starts. Later asset movements do not
-- silently change the checklist or erase evidence of a discrepancy.
CREATE TABLE IF NOT EXISTS public.asset_count_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.asset_count_sessions(id) ON DELETE RESTRICT,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  asset_code text NOT NULL,
  asset_name text,
  expected_location_id bigint,
  expected_location_name text,
  expected_holder_id bigint,
  expected_holder_name text,
  holder_source text,
  expected_status text NOT NULL,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','found','mismatch','missing')),
  observed_location_id bigint,
  observed_location_name text,
  observed_holder_id bigint,
  observed_holder_name text,
  notes text,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  checked_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  checked_at timestamptz,
  UNIQUE(session_id,asset_id)
);

CREATE TABLE IF NOT EXISTS public.asset_count_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  item_id bigint NOT NULL REFERENCES public.asset_count_items(id) ON DELETE RESTRICT,
  request_payload jsonb NOT NULL,
  previous_result text NOT NULL,
  result text NOT NULL CHECK (result IN ('found','mismatch','missing')),
  observed_location_name text,
  observed_holder_name text,
  notes text,
  checked_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_count_items_asset_idx ON public.asset_count_items(asset_id,session_id);
CREATE INDEX IF NOT EXISTS asset_count_events_item_idx ON public.asset_count_events(item_id,id DESC);
CREATE INDEX IF NOT EXISTS asset_audit_logs_asset_history_idx ON public.asset_audit_logs(asset_id,created_at DESC,id DESC);

COMMIT;
