import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountError,
  createAccount,
  updateAccount,
} from "../lib/accounts.js";

function fakePool(handler) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });
      return handler(normalized, params);
    },
    release() {},
  };

  return {
    calls,
    async connect() {
      return client;
    },
  };
}

const baseUpdate = {
  email: "admin@example.com",
  username: "admin",
  displayName: "Admin",
  role: "Admin",
  isActive: true,
  userId: "",
};

test("an Admin cannot deactivate their own account", async () => {
  const pool = fakePool((sql) => {
    if (sql.startsWith("SELECT id::text AS id, role")) {
      return {
        rowCount: 1,
        rows: [{ id: "1", role: "Admin", is_active: true, user_id: null }],
      };
    }
    return { rowCount: 0, rows: [] };
  });

  await assert.rejects(
    updateAccount("1", { ...baseUpdate, isActive: false }, "1", pool),
    (error) => error instanceof AccountError && error.status === 409,
  );
  assert.equal(pool.calls.some((call) => call.sql.startsWith("UPDATE public.app_accounts")), false);
});

test("the last active Admin cannot be downgraded", async () => {
  const pool = fakePool((sql) => {
    if (sql.startsWith("SELECT id::text AS id, role")) {
      return {
        rowCount: 1,
        rows: [{ id: "2", role: "Admin", is_active: true, user_id: null }],
      };
    }
    if (sql.startsWith("SELECT COUNT(*)::int AS count")) {
      return { rowCount: 1, rows: [{ count: 1 }] };
    }
    return { rowCount: 0, rows: [] };
  });

  await assert.rejects(
    updateAccount("2", { ...baseUpdate, role: "IT Staff" }, "1", pool),
    (error) => error instanceof AccountError && error.status === 409,
  );
});

test("create account returns safe fields and sends only a hash to SQL", async () => {
  let insertParams;
  const pool = fakePool((sql, params) => {
    if (sql.startsWith("INSERT INTO public.app_accounts")) {
      insertParams = params;
      return {
        rowCount: 1,
        rows: [{
          id: "3",
          email: params[0],
          username: params[1],
          display_name: params[2],
          role: params[4],
          is_active: params[5],
          user_id: null,
        }],
      };
    }
    return { rowCount: 0, rows: [] };
  });

  const password = "StrongPass#123";
  const account = await createAccount({
    email: " New.User@Example.com ",
    username: "new.user",
    displayName: "New User",
    role: "Read-only",
    isActive: true,
    userId: "",
    password,
    confirmPassword: password,
  }, pool);

  assert.equal(account.email, "new.user@example.com");
  assert.equal(Object.hasOwn(account, "password_hash"), false);
  assert.equal(insertParams[1], "new.user");
  assert.notEqual(insertParams[3], password);
  assert.match(insertParams[3], /^\$2[aby]\$/);
});
