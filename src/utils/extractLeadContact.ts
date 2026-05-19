import { normalizeLeadDataInput } from "./normalizeLeadData";

const EMAIL_KEYS = [
  "email",
  "Email",
  "EMAIL",
  "email_address",
  "emailAddress",
  "contact_email",
  "contactEmail",
];

const FIRST_NAME_KEYS = [
  "firstname",
  "firstName",
  "first_name",
  "FirstName",
  "name",
  "full_name",
  "fullName",
  "contact_name",
  "contactName",
];

const LAST_NAME_KEYS = ["lastname", "lastName", "last_name", "LastName"];

function pickString(
  data: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractEmailFromLeadData(leadData: unknown): string | null {
  const data = normalizeLeadDataInput(leadData);
  const raw = pickString(data, EMAIL_KEYS);
  if (!raw) return null;
  const email = raw.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function extractNameFromLeadData(leadData: unknown): {
  firstname: string;
  lastname: string;
} {
  const data = normalizeLeadDataInput(leadData);
  let firstname = pickString(data, FIRST_NAME_KEYS) || "";
  let lastname = pickString(data, LAST_NAME_KEYS) || "";

  if (firstname && !lastname && firstname.includes(" ")) {
    const parts = firstname.split(/\s+/);
    firstname = parts[0] || "";
    lastname = parts.slice(1).join(" ") || "";
  }

  return {
    firstname: firstname || "Customer",
    lastname: lastname || "",
  };
}
