import bcrypt from "bcryptjs";

export const ACCOUNT_ROLES = ["Admin", "IT Staff", "Read-only"];
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export class AccountValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validatePassword(password, label = "Password") {
  if (typeof password !== "string") {
    throw new AccountValidationError(`${label} is required`);
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AccountValidationError(
      `${label} must contain at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    throw new AccountValidationError(
      `${label} must not exceed ${PASSWORD_MAX_BYTES} UTF-8 bytes`,
    );
  }

  if (!/[a-z]/.test(password)) {
    throw new AccountValidationError(
      `${label} must contain a lowercase English letter`,
    );
  }

  if (!/[A-Z]/.test(password)) {
    throw new AccountValidationError(
      `${label} must contain an uppercase English letter`,
    );
  }

  if (!/\d/.test(password)) {
    throw new AccountValidationError(`${label} must contain a number`);
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new AccountValidationError(
      `${label} must contain a special character`,
    );
  }

  return password;
}

export async function hashPassword(password) {
  validatePassword(password);
  return bcrypt.hash(password, 12);
}

export async function passwordMatches(password, hash) {
  if (typeof password !== "string" || typeof hash !== "string") {
    return false;
  }

  return bcrypt.compare(password, hash);
}
