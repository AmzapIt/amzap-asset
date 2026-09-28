import { getDbPool } from "./db.js";
import {
  ACCOUNT_ROLES,
  AccountValidationError,
  hashPassword,
  passwordMatches,
  validatePassword,
} from "./account-security.js";

export class AccountError extends AccountValidationError {}

const fail = (message, status = 400) => {
  throw new AccountError(message, status);
};

function id(value, label = "Account ID", optional = false) {
  if (optional && (value == null || value === "")) return null;

  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    fail(`Invalid ${label}`);
  }

  return value;
}

function email(value) {
  if (typeof value !== "string") fail("Email is required");
  const normalized = value.trim().toLowerCase();

  if (
    !normalized ||
    normalized.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    fail("Invalid email");
  }

  return normalized;
}

function username(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") fail("Invalid username");
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > 100 ||
    !/^[a-z0-9._-]+$/.test(normalized)
  ) {
    fail(
      "Username must contain 3–100 lowercase letters, numbers, dots, underscores, or hyphens",
    );
  }

  return normalized;
}

function displayName(value) {
  if (typeof value !== "string") fail("Display name is required");
  const normalized = value.trim();

  if (!normalized || normalized.length > 255) {
    fail("Display name must contain 1–255 characters");
  }

  return normalized;
}

function role(value) {
  if (!ACCOUNT_ROLES.includes(value)) fail("Invalid account role");
  return value;
}

function active(value) {
  if (value !== true && value !== false) fail("Invalid account status");
  return value;
}

function passwordPair(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("Invalid request");
  }

  if (body.password !== body.confirmPassword) {
    fail("Password confirmation does not match");
  }

  try {
    return validatePassword(body.password);
  } catch (error) {
    if (error instanceof AccountValidationError) {
      fail(error.message, error.status);
    }
    throw error;
  }
}

function accountInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("Invalid request");
  }

  return {
    email: email(body.email),
    username: username(body.username),
    displayName: displayName(body.displayName),
    role: role(body.role),
    isActive: active(body.isActive),
    userId: id(body.userId, "Employee ID", true),
  };
}

function databaseError(error) {
  if (error?.code !== "23505") return error;

  if (
    error.constraint === "app_accounts_email_lower_key" ||
    error.constraint === "app_accounts_email_key"
  ) {
    return new AccountError("Email is already used by another account", 409);
  }

  if (error.constraint === "app_accounts_user_id_unique") {
    return new AccountError("Employee already has a login account", 409);
  }

  if (error.constraint === "app_accounts_username_lower_key") {
    return new AccountError("Username is already used by another account", 409);
  }

  return new AccountError("Account data already exists", 409);
}

async function requireEmployee(client, userId, currentUserId = null) {
  if (userId == null) return;

  const result = await client.query(
    `SELECT id
     FROM public."user"
     WHERE id=$1 AND (is_active=true OR id=$2::bigint)
     FOR SHARE`,
    [userId, currentUserId],
  );

  if (!result.rowCount) {
    fail("Employee must be active");
  }
}

const safeColumns = `
  id::text AS id, email, username, display_name, role, is_active,
  user_id::text AS user_id, must_change_password,
  created_at, updated_at
`;

export async function createAccount(body, pool = getDbPool()) {
  const input = accountInput(body);
  const password = passwordPair(body);
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await requireEmployee(client, input.userId);

    const account = (
      await client.query(
        `INSERT INTO public.app_accounts
           (email, username, display_name, password_hash, role, is_active, user_id,
            must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)
         RETURNING ${safeColumns}`,
        [
          input.email,
          input.username,
          input.displayName,
          passwordHash,
          input.role,
          input.isActive,
          input.userId,
        ],
      )
    ).rows[0];

    await client.query("COMMIT");
    return account;
  } catch (error) {
    await client.query("ROLLBACK");
    throw databaseError(error);
  } finally {
    client.release();
  }
}

export async function updateAccount(
  accountId,
  body,
  actorAccountId,
  pool = getDbPool(),
) {
  id(accountId);
  id(actorAccountId, "Current account ID");
  const input = accountInput(body);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // Account updates are rare. A transaction advisory lock keeps the
    // "last active Admin" check correct across concurrent requests.
    await client.query("SELECT pg_advisory_xact_lock(190019)");

    const current = (
      await client.query(
        `SELECT id::text AS id, role, is_active, user_id::text AS user_id
         FROM public.app_accounts WHERE id=$1 FOR UPDATE`,
        [accountId],
      )
    ).rows[0];

    if (!current) fail("Account not found", 404);

    const editingSelf = current.id === actorAccountId;
    if (editingSelf && (!input.isActive || input.role !== "Admin")) {
      fail("You cannot deactivate or remove the Admin role from your own account", 409);
    }

    if (
      current.role === "Admin" &&
      current.is_active === true &&
      (input.role !== "Admin" || !input.isActive)
    ) {
      const activeAdmins = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM public.app_accounts
         WHERE role='Admin' AND is_active=true`,
      );

      if (activeAdmins.rows[0].count <= 1) {
        fail("The last active Admin account cannot be deactivated or downgraded", 409);
      }
    }

    await requireEmployee(client, input.userId, current.user_id);

    const account = (
      await client.query(
        `UPDATE public.app_accounts
         SET email=$2, username=$3, display_name=$4, role=$5, is_active=$6,
             user_id=$7, updated_at=NOW()
         WHERE id=$1
         RETURNING ${safeColumns}`,
        [
          accountId,
          input.email,
          input.username,
          input.displayName,
          input.role,
          input.isActive,
          input.userId,
        ],
      )
    ).rows[0];

    await client.query("COMMIT");
    return account;
  } catch (error) {
    await client.query("ROLLBACK");
    throw databaseError(error);
  } finally {
    client.release();
  }
}

export async function resetAccountPassword(
  accountId,
  body,
  actorAccountId,
  pool = getDbPool(),
) {
  id(accountId);
  id(actorAccountId, "Current account ID");

  if (accountId === actorAccountId) {
    fail("Use Change Password to update your own password", 409);
  }

  const password = passwordPair(body);
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `UPDATE public.app_accounts
     SET password_hash=$2, must_change_password=true, updated_at=NOW()
     WHERE id=$1
     RETURNING id::text AS id`,
    [accountId, passwordHash],
  );

  if (!result.rowCount) fail("Account not found", 404);
  return result.rows[0];
}

export async function changeOwnPassword(
  accountId,
  body,
  pool = getDbPool(),
) {
  id(accountId);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("Invalid request");
  }
  if (
    typeof body.currentPassword !== "string" ||
    !body.currentPassword ||
    body.currentPassword.length > 1000
  ) {
    fail("Current password is required");
  }

  const newPassword = passwordPair({
    password: body.newPassword,
    confirmPassword: body.confirmPassword,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const account = (
      await client.query(
        `SELECT id, password_hash
         FROM public.app_accounts
         WHERE id=$1 AND is_active=true
         FOR UPDATE`,
        [accountId],
      )
    ).rows[0];

    if (!account) fail("Active account not found", 404);

    if (!(await passwordMatches(body.currentPassword, account.password_hash))) {
      fail("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(newPassword);
    await client.query(
      `UPDATE public.app_accounts
       SET password_hash=$2, must_change_password=false, updated_at=NOW()
       WHERE id=$1`,
      [accountId, passwordHash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
