/**
 * Canonical lead display / search code: campaign initials + hyphen + numeric id.
 * Example: campaign "just new one" → JNO-1737
 * Keeps backward-compatible search: "JNO1737" (no hyphen) still maps to same id in parsers.
 */

export function campaignNameToLeadCodeInitials(campaignName: string): string {
  const tokens = String(campaignName || "")
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  return tokens
    .map((token) => String(token[0] || "").toUpperCase())
    .filter(Boolean)
    .join("");
}

export function buildLeadCodeFromCampaignAndId(
  campaignName: string,
  numericId: number,
): string {
  const initials = campaignNameToLeadCodeInitials(campaignName);
  const prefix = initials.length > 0 ? initials : "L";
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return `${prefix}-0`;
  }
  return `${prefix}-${numericId}`;
}

/** Match user search against canonical code with or without hyphen (legacy JNO1737 vs JNO-1737). */
export function leadCodeSearchHaystack(
  campaignName: string,
  numericId: number,
): string {
  const canonical = buildLeadCodeFromCampaignAndId(campaignName, numericId).toLowerCase();
  const compact = canonical.replace(/-/g, "");
  return `${canonical} ${compact}`;
}

/**
 * Normalize search box input: trim, NFKC, unify Unicode dash/minus to ASCII hyphen.
 * So "JNO‐1737" (U+2010) and "JNO-1737" behave the same.
 */
export function normalizeLeadCodeSearchInput(raw: string): string {
  return String(raw || "")
    .trim()
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * True if `rawSearch` matches this lead's display code (hyphen, legacy compact, Unicode dash in query).
 */
export function leadCodeMatchesSearch(
  campaignName: string,
  numericId: number,
  rawSearch: string,
): boolean {
  const norm = normalizeLeadCodeSearchInput(rawSearch).trim().toLowerCase();
  if (!norm) return true;
  if (!Number.isFinite(numericId) || numericId <= 0) return false;
  const hay = leadCodeSearchHaystack(campaignName, numericId);
  const hayCompact = hay.replace(/-/g, "").replace(/\s+/g, " ").trim();
  const qCompact = norm.replace(/-/g, "");
  return hay.includes(norm) || hayCompact.includes(qCompact);
}

/** Enriched lead object (assignees, leadCode, …): JSON substring OR lead-code match. */
export function leadEnrichedRowMatchesSearch(
  lead: Record<string, unknown>,
  rawSearch: string,
): boolean {
  const norm = normalizeLeadCodeSearchInput(rawSearch).trim().toLowerCase();
  if (!norm) return true;
  if (JSON.stringify(lead).toLowerCase().includes(norm)) return true;
  const id = Number(lead.id);
  const campaign = String(lead.campaignName ?? "");
  return leadCodeMatchesSearch(campaign, id, rawSearch);
}

/** Row with leadData + campaign: partial fields OR lead-code match (campaign list flows). */
export function leadPartialRowMatchesSearch(
  lead: { campaignName?: unknown; id?: unknown; leadData?: unknown },
  rawSearch: string,
): boolean {
  const norm = normalizeLeadCodeSearchInput(rawSearch).trim().toLowerCase();
  if (!norm) return true;
  const leadDataStr = JSON.stringify(lead.leadData ?? {}).toLowerCase();
  const campaignNameStr = String(lead.campaignName ?? "").toLowerCase();
  if (leadDataStr.includes(norm) || campaignNameStr.includes(norm)) return true;
  const id = Number(lead.id);
  const campaign = String(lead.campaignName ?? "");
  return leadCodeMatchesSearch(campaign, id, rawSearch);
}
