-- Central accessory warehouse. Existing employee issues keep their IDs/history.
-- Historical returns are not assumed to still be in the warehouse: opening
-- warehouse balances are zero; only currently held legacy items form opening stock.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('accessory-inventory', 0));

CREATE TABLE IF NOT EXISTS public.accessory_stock_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accessory_type_id bigint NOT NULL REFERENCES public.accessory_types(id),
  brand varchar(150), model varchar(150), serial_number varchar(200),
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accessory_stock_identity
  ON public.accessory_stock_items (accessory_type_id,
    lower(coalesce(brand, '')), lower(coalesce(model, '')),
    lower(coalesce(serial_number, '')));

ALTER TABLE public.employee_accessories
  ADD COLUMN IF NOT EXISTS stock_item_id bigint REFERENCES public.accessory_stock_items(id),
  ADD COLUMN IF NOT EXISTS returned_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disposed_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_reason varchar(20),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.employee_accessories'::regclass AND conname='accessory_processed_quantities') THEN
    ALTER TABLE public.employee_accessories ADD CONSTRAINT accessory_processed_quantities
      CHECK (returned_quantity >= 0 AND transferred_quantity >= 0 AND disposed_quantity >= 0
        AND returned_quantity + transferred_quantity + disposed_quantity <= quantity);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS employee_accessories_stock ON public.employee_accessories(stock_item_id);

CREATE TABLE IF NOT EXISTS public.accessory_operations (
  request_id uuid PRIMARY KEY,
  actor_account_id bigint NOT NULL REFERENCES public.app_accounts(id),
  fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.accessory_stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock_item_id bigint NOT NULL REFERENCES public.accessory_stock_items(id),
  employee_accessory_id bigint REFERENCES public.employee_accessories(id),
  related_accessory_id bigint REFERENCES public.employee_accessories(id),
  action varchar(20) NOT NULL CHECK (action IN ('opening','receive','issue','return','transfer','dispose','edit')),
  quantity integer NOT NULL CHECK (quantity >= 0),
  stock_delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  from_user_id bigint REFERENCES public."user"(id),
  to_user_id bigint REFERENCES public."user"(id),
  event_date date NOT NULL,
  reason varchar(500) NOT NULL,
  notes text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_account_id bigint REFERENCES public.app_accounts(id),
  request_id uuid REFERENCES public.accessory_operations(request_id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accessory_movements_stock ON public.accessory_stock_movements(stock_item_id, id DESC);
CREATE INDEX IF NOT EXISTS accessory_movements_employee ON public.accessory_stock_movements(employee_accessory_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS accessory_opening_once ON public.accessory_stock_movements(stock_item_id) WHERE action='opening';

-- Normalize only new stock identities; employee snapshot text stays intact.
CREATE TEMP TABLE accessory_legacy_opening ON COMMIT DROP AS
SELECT id FROM public.employee_accessories WHERE stock_item_id IS NULL;
INSERT INTO public.accessory_stock_items (accessory_type_id, brand, model, serial_number)
SELECT DISTINCT ON (accessory_type_id, lower(coalesce(nullif(trim(brand),''),'')),
  lower(coalesce(nullif(trim(model),''),'')), lower(coalesce(nullif(trim(serial_number),''),'')))
  accessory_type_id, nullif(trim(brand),''), nullif(trim(model),''), nullif(trim(serial_number),'')
FROM public.employee_accessories
WHERE stock_item_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.employee_accessories ea SET stock_item_id=s.id
FROM public.accessory_stock_items s
WHERE ea.stock_item_id IS NULL AND ea.accessory_type_id=s.accessory_type_id
  AND lower(coalesce(nullif(trim(ea.brand),''),''))=lower(coalesce(s.brand,''))
  AND lower(coalesce(nullif(trim(ea.model),''),''))=lower(coalesce(s.model,''))
  AND lower(coalesce(nullif(trim(ea.serial_number),''),''))=lower(coalesce(s.serial_number,''));
UPDATE public.employee_accessories
SET returned_quantity=quantity, close_reason='return'
WHERE returned_date IS NOT NULL AND returned_quantity+transferred_quantity+disposed_quantity=0;

INSERT INTO public.accessory_stock_movements
  (stock_item_id, action, quantity, stock_delta, balance_after, event_date, reason)
SELECT s.id, 'opening', coalesce(sum(ea.quantity-ea.returned_quantity-ea.transferred_quantity-ea.disposed_quantity)
  FILTER (WHERE ea.returned_date IS NULL),0)::integer, 0, s.available_quantity,
  (now() AT TIME ZONE 'Asia/Bangkok')::date, 'ยอดเปิดจากอุปกรณ์ที่พนักงานถืออยู่ก่อนเริ่มระบบ Stock'
FROM public.accessory_stock_items s
LEFT JOIN public.employee_accessories ea ON ea.stock_item_id=s.id
WHERE EXISTS (SELECT 1 FROM public.employee_accessories legacy
  JOIN accessory_legacy_opening original ON original.id=legacy.id
  WHERE legacy.stock_item_id=s.id)
GROUP BY s.id
ON CONFLICT DO NOTHING;
COMMIT;
