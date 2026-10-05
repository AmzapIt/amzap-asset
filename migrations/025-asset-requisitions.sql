BEGIN;

-- Document only: never updates assets, assignments, or stock balances.
CREATE TABLE IF NOT EXISTS public.asset_requisitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  user_id bigint REFERENCES public."user"(id) ON DELETE SET NULL,
  requested_date date NOT NULL,
  request_kind text NOT NULL CHECK (request_kind IN ('additional', 'replacement')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  employee_snapshot jsonb NOT NULL CHECK (jsonb_typeof(employee_snapshot) = 'object'),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 20),
  request_payload jsonb NOT NULL,
  created_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_requisitions_user_idx ON public.asset_requisitions(user_id, id DESC);
CREATE INDEX IF NOT EXISTS asset_requisitions_date_idx ON public.asset_requisitions(requested_date DESC, id DESC);

COMMIT;
