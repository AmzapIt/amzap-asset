BEGIN;

-- Periodic employee confirmation is documentary only. These tables never
-- update assignments, asset ownership, or accessory stock.
CREATE TABLE IF NOT EXISTS public.asset_verification_rounds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  round_no integer NOT NULL CHECK (round_no BETWEEN 1 AND 99),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  next_sequence integer NOT NULL DEFAULT 1 CHECK (next_sequence > 0),
  created_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, round_no)
);

CREATE TABLE IF NOT EXISTS public.asset_verification_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_id bigint NOT NULL REFERENCES public.asset_verification_rounds(id),
  user_id bigint REFERENCES public."user"(id) ON DELETE SET NULL,
  sequence_no integer NOT NULL CHECK (sequence_no BETWEEN 1 AND 9999),
  document_no text NOT NULL UNIQUE,
  form_revision text NOT NULL DEFAULT 'FM-IT-002 Rev.00',
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'signed', 'cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  signed_date date,
  check_result text CHECK (check_result IN ('matched', 'discrepancy')),
  check_notes text,
  signed_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  signed_at timestamptz,
  cancel_reason text,
  cancelled_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  UNIQUE (round_id, sequence_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_verification_active_user_idx
  ON public.asset_verification_records (round_id, user_id)
  WHERE status <> 'cancelled' AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS asset_verification_round_records_idx
  ON public.asset_verification_records (round_id, id DESC);

COMMIT;
