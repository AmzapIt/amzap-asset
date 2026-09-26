BEGIN;

-- Temporary or legacy passwords are allowed to authenticate only while this
-- flag is true. The proxy then restricts the session to Change Password until
-- a policy-compliant replacement has been saved.
ALTER TABLE public.app_accounts
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Email remains available for login, while username provides a short internal
-- login ID such as the requested legacy Admin account.
ALTER TABLE public.app_accounts
  ADD COLUMN IF NOT EXISTS username varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_username_lower_key
  ON public.app_accounts (lower(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.app_accounts.must_change_password IS
  'Restricts the account to changing its password before normal system access';

COMMENT ON COLUMN public.app_accounts.username IS
  'Optional case-insensitive login name; email login remains supported';

COMMIT;
