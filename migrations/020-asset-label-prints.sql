-- One confirmed print job may contain several Asset labels. Keep each
-- confirmation as an event so reprints can be counted and audited.
BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_label_print_batches (
  id uuid PRIMARY KEY,
  asset_ids bigint[] NOT NULL,
  source varchar(12) NOT NULL DEFAULT 'print' CHECK (source IN ('print', 'existing')),
  printed_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Also upgrades databases where the first version of this migration ran.
ALTER TABLE public.asset_label_print_batches
  ADD COLUMN IF NOT EXISTS source varchar(12) NOT NULL DEFAULT 'print'
  CHECK (source IN ('print', 'existing'));

CREATE TABLE IF NOT EXISTS public.asset_label_prints (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.asset_label_print_batches(id),
  asset_id bigint REFERENCES public.assets(id) ON DELETE SET NULL,
  asset_code varchar(100) NOT NULL,
  printed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_label_print_once_per_batch UNIQUE (batch_id, asset_id)
);

CREATE INDEX IF NOT EXISTS asset_label_prints_asset_history
  ON public.asset_label_prints (asset_id, printed_at DESC, id DESC);

COMMIT;
