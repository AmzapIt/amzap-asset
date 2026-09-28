import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountValidationError,
  hashPassword,
  passwordMatches,
  validatePassword,
} from "../lib/account-security.js";

test("password policy accepts 6–12 characters without character requirements", () => {
  for (const password of [
    "123456",
    "123456789012",
    "abcdef",
    "ABCDEF",
    "!!!!!!",
    "กขคงจฉ",
    "      ",
    "  abc ",
  ]) {
    assert.equal(validatePassword(password), password);
  }
});

test("password policy rejects fewer than 6 or more than 12 characters", () => {
  for (const password of ["", "12345", "1234567890123"]) {
    assert.throws(() => validatePassword(password), AccountValidationError);
  }
});

test("password policy requires a string", () => {
  for (const password of [null, undefined, 123456, {}, []]) {
    assert.throws(() => validatePassword(password), AccountValidationError);
  }
});

test("password hashing stores no plaintext and verifies correctly", async () => {
  const password = "123456";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await passwordMatches(password, hash), true);
  assert.equal(await passwordMatches("654321", hash), false);
});
