/**
 * Coerce leadData to a plain object before Lead.create / update.
 * Fixes double-encoded JSON strings (e.g. "\"{\\\"a\\\":1}\"") from some imports.
 */
export function normalizeLeadDataInput(raw: unknown): Record<string, unknown> {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return {};

  let current: unknown = (raw as string).trim();
  for (let i = 0; i < 10; i++) {
    if (typeof current !== "string") break;
    const s = current.trim();
    if (!s) return {};
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
      try {
        current = JSON.parse(s);
        continue;
      } catch {
        break;
      }
    }
    if (
      (s.startsWith("{") && s.endsWith("}")) ||
      (s.startsWith("[") && s.endsWith("]"))
    ) {
      try {
        const p = JSON.parse(s);
        if (typeof p === "string") {
          current = p;
          continue;
        }
        if (typeof p === "object" && p !== null && !Array.isArray(p)) {
          return p as Record<string, unknown>;
        }
        return {};
      } catch {
        return {};
      }
    }
    break;
  }
  return {};
}

/** Strip LRM/RLM/etc. so Fiverr-style phones still count as non-empty. */
const STRIP_BIDI = /[\u200e\u200f\u202a-\u202e]/g;

/** Field names used across campaigns / imports (must stay in sync with CRM frontend helpers). */
export const LEAD_DATA_PHONE_KEYS: string[] = [
  "phone_number",
  "phoneNumber",
  "phone",
  "Phone",
  "PHONE",
  "number",
  "number_",
  "contactNumber",
  "contact_number",
  "mobile",
  "cell",
  "cellphone",
  "telephone",
  "tel",
  "whatsapp",
];

/**
 * First non-empty phone-like value from leadData (after JSON coercion + bidi strip).
 * Used for contactState=present|missing on admin master lists.
 */
export function extractPhoneRawFromLeadData(leadData: unknown): string {
  const ld = normalizeLeadDataInput(leadData);
  for (const k of LEAD_DATA_PHONE_KEYS) {
    const v = ld[k];
    if (v == null) continue;
    const s = String(v).replace(STRIP_BIDI, "").trim();
    if (s.length > 0) return s;
  }
  return "";
}

export function leadRowHasContactPhone(lead: { leadData?: unknown }): boolean {
  return extractPhoneRawFromLeadData(lead?.leadData) !== "";
}
