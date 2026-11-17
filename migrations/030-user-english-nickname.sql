-- Keep English employee names in the same user record as their Thai names.
-- full_name_en already exists in some databases; include it for fresh installs.
ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS full_name_en varchar(200),
  ADD COLUMN IF NOT EXISTS nickname_en varchar(100);
