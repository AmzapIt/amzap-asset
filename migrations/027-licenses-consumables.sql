BEGIN;

-- License seats are reusable. Assignment rows remain as history after release.
CREATE TABLE IF NOT EXISTS public.software_licenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
  vendor_id bigint REFERENCES public.vendors(id) ON DELETE SET NULL,
  total_seats integer NOT NULL CHECK (total_seats BETWEEN 1 AND 100000),
  product_key_encrypted text,
  product_key_hint varchar(8),
  purchase_date date,
  expiration_date date,
  purchase_cost numeric(14,2) CHECK (purchase_cost >= 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_seat_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id bigint NOT NULL REFERENCES public.software_licenses(id) ON DELETE RESTRICT,
  user_id bigint REFERENCES public."user"(id) ON DELETE RESTRICT,
  asset_id bigint REFERENCES public.assets(id) ON DELETE RESTRICT,
  assigned_date date NOT NULL,
  released_date date,
  notes text,
  release_reason varchar(500),
  assigned_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  released_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CHECK ((user_id IS NOT NULL) <> (asset_id IS NOT NULL)),
  CHECK ((released_at IS NULL AND released_date IS NULL) OR
         (released_at IS NOT NULL AND released_date IS NOT NULL AND released_date >= assigned_date))
);
CREATE INDEX IF NOT EXISTS license_assignment_license_idx
  ON public.license_seat_assignments(license_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS license_one_active_user_seat
  ON public.license_seat_assignments(license_id,user_id)
  WHERE released_at IS NULL AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS license_one_active_asset_seat
  ON public.license_seat_assignments(license_id,asset_id)
  WHERE released_at IS NULL AND asset_id IS NOT NULL;

-- Consumables leave stock when issued. There is intentionally no return action.
CREATE TABLE IF NOT EXISTS public.consumable_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
  category varchar(120),
  brand varchar(150),
  model varchar(150),
  unit varchar(40) NOT NULL DEFAULT 'ชิ้น' CHECK (length(btrim(unit)) > 0),
  vendor_id bigint REFERENCES public.vendors(id) ON DELETE SET NULL,
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity BETWEEN 0 AND 100000),
  min_quantity integer NOT NULL DEFAULT 0 CHECK (min_quantity BETWEEN 0 AND 100000),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consumable_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES public.consumable_items(id) ON DELETE RESTRICT,
  action varchar(12) NOT NULL CHECK (action IN ('receive','issue','adjust')),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  stock_delta integer NOT NULL CHECK (stock_delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  user_id bigint REFERENCES public."user"(id) ON DELETE RESTRICT,
  event_date date NOT NULL,
  reason varchar(500) NOT NULL CHECK (length(btrim(reason)) > 0),
  notes text,
  actor_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  request_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((action = 'issue') = (user_id IS NOT NULL)),
  CHECK ((action = 'receive' AND stock_delta > 0) OR
         (action = 'issue' AND stock_delta < 0) OR action = 'adjust')
);
CREATE INDEX IF NOT EXISTS consumable_movements_item_idx
  ON public.consumable_movements(item_id,id DESC);
CREATE INDEX IF NOT EXISTS consumable_movements_user_idx
  ON public.consumable_movements(user_id,id DESC) WHERE user_id IS NOT NULL;

-- One request ID can commit only once, even after a browser retry.
CREATE TABLE IF NOT EXISTS public.inventory_operations (
  request_id uuid PRIMARY KEY,
  kind varchar(40) NOT NULL,
  actor_account_id bigint NOT NULL REFERENCES public.app_accounts(id),
  fingerprint char(64) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id bigint NOT NULL REFERENCES public.software_licenses(id) ON DELETE RESTRICT,
  assignment_id bigint REFERENCES public.license_seat_assignments(id) ON DELETE RESTRICT,
  action varchar(12) NOT NULL CHECK (action IN ('create','update','assign','release')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  request_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_events_license_idx
  ON public.license_events(license_id,id DESC);

COMMIT;
