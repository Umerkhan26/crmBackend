import crypto from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "v1";

const deriveKey = (): Buffer => {
  const raw =
    process.env.SMTP_CREDENTIALS_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "crm-smtp-credentials-dev-key";
  return crypto.createHash("sha256").update(raw).digest();
};

export const encryptSmtpPassword = (plain: string): string => {
  const text = String(plain || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
};

export const decryptSmtpPassword = (stored: string): string => {
  const value = String(stored || "");
  if (!value) return "";
  if (!value.startsWith(`${PREFIX}:`)) {
    return value;
  }
  const parts = value.split(":");
  if (parts.length !== 4) return value;
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
};

export const maskSmtpPassword = (stored: string): string => {
  if (!stored) return "";
  try {
    const plain = decryptSmtpPassword(stored);
    if (!plain) return "";
    if (plain.length <= 4) return "****";
    return `${plain.slice(0, 2)}${"*".repeat(Math.min(plain.length - 2, 8))}`;
  } catch {
    return "********";
  }
};
