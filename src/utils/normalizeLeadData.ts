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
