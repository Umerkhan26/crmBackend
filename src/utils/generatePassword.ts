import crypto from "crypto";

/**
 * Short, easy-to-read temporary password for customer portal (e-mailed in plain text).
 * DB stores bcrypt hash only — never send the hash to the customer.
 * Format: 3 letters + 4 digits (e.g. GWB4728), no special characters.
 */
export function generateTemporaryPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const bytes = crypto.randomBytes(8);
  let letterPart = "";
  for (let i = 0; i < 3; i++) {
    letterPart += letters[bytes[i]! % letters.length];
  }
  let digitPart = "";
  for (let i = 3; i < 7; i++) {
    digitPart += digits[bytes[i]! % digits.length];
  }
  return `${letterPart}${digitPart}`;
}
