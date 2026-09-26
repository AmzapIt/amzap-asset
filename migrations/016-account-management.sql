BEGIN;

-- Login compares email case-insensitively, so the database must enforce the
-- same rule to prevent two accounts that differ only by letter casing.
CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_email_lower_key
  ON public.app_accounts (lower(email));

-- One employee represents one person and can own at most one login account.
-- System-only accounts may keep user_id NULL.
CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_user_id_unique
  ON public.app_accounts (user_id)
  WHERE user_id IS NOT NULL;

COMMIT;
