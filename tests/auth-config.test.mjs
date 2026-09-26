import assert from "node:assert/strict";
import test from "node:test";
import { authConfig } from "../auth.config.js";

function authorize(pathname, auth) {
  return authConfig.callbacks.authorized({
    auth,
    request: { nextUrl: new URL(pathname, "https://asset.example.com") },
  });
}

test("forced-password session is redirected away from normal pages", () => {
  const result = authorize("/assets", {
    user: { mustChangePassword: true },
  });

  assert.equal(result.status, 302);
  assert.equal(
    result.headers.get("location"),
    "https://asset.example.com/account/password",
  );
});

test("forced-password session may access password page and endpoint", () => {
  const session = { user: { mustChangePassword: true } };

  assert.equal(authorize("/account/password", session), true);
  assert.equal(authorize("/api/account/password", session), true);
});

test("ordinary logged-in session retains normal navigation", () => {
  assert.equal(
    authorize("/assets", { user: { mustChangePassword: false } }),
    true,
  );
});
