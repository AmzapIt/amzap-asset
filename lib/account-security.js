import bcrypt from "bcryptjs";

export const ACCOUNT_ROLES = ["Admin", "IT Staff", "Read-only"];
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 12;

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

  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AccountValidationError(
      `${label} must contain ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
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
