-- Store an employee's primary/work location separately from asset assignment
-- location snapshots.
ALTER TABLE public."user"
ADD COLUMN IF NOT EXISTS location_id bigint;

ALTER TABLE public."user"
DROP CONSTRAINT IF EXISTS user_location_id_fkey;

ALTER TABLE public."user"
ADD CONSTRAINT user_location_id_fkey
FOREIGN KEY (location_id)
REFERENCES public.locations(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_location_id
ON public."user" (location_id);
