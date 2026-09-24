-- Optional employee nickname used only for display and search.
ALTER TABLE public."user"
ADD COLUMN IF NOT EXISTS nickname varchar(100);
