BEGIN;

ALTER TABLE public.asset_requisitions
  ADD COLUMN IF NOT EXISTS it_staff_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.asset_requisition_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requisition_id bigint NOT NULL REFERENCES public.asset_requisitions(id) ON DELETE CASCADE,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  request_payload jsonb NOT NULL,
  request_kind text NOT NULL CHECK (request_kind IN ('additional', 'replacement')),
  requested_date date NOT NULL,
  reason text NOT NULL,
  it_staff_name text NOT NULL,
  employee_snapshot jsonb NOT NULL CHECK (jsonb_typeof(employee_snapshot) = 'object'),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  modified_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  modified_by_name text NOT NULL,
  modified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisition_id, revision_no)
);

CREATE INDEX IF NOT EXISTS asset_requisition_revisions_history_idx
  ON public.asset_requisition_revisions(requisition_id, revision_no DESC);

COMMIT;
