import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountValidationError,
  hashPassword,
  passwordMatches,
  validatePassword,
} from "../lib/account-security.js";

test("password policy accepts a strong password", () => {
  assert.equal(validatePassword("StrongPass#123"), "StrongPass#123");
});

test("password policy rejects missing character groups and short values", () => {
  for (const password of [
    "Short#1A",
    "NOLOWERCASE#123",
    "nouppercase#123",
    "NoNumberHere#!",
    "NoSpecial1234",
  ]) {
    assert.throws(() => validatePassword(password), AccountValidationError);
  }
});

test("password policy enforces bcrypt's 72-byte boundary", () => {
  assert.throws(
    () => validatePassword(`Aa1!${"ก".repeat(24)}`),
    /72 UTF-8 bytes/,
  );
});

test("password hashing stores no plaintext and verifies correctly", async () => {
  const password = "StrongPass#123";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await passwordMatches(password, hash), true);
  assert.equal(await passwordMatches("WrongPass#123", hash), false);
});
