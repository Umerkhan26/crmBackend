import Brand from "../models/brand.model";

export type PortalBrandResolveInput = {
  host?: string;
  brandId?: number;
  brandSlug?: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Subdomain from production host, e.g. customer.emrills.com → emrills */
export const subdomainFromHost = (host: string): string | null => {
  const normalized = (host || "").toLowerCase().trim().split(":")[0]!;
  if (!normalized || LOCAL_HOSTS.has(normalized)) return null;

  if (normalized.startsWith("customer.")) {
    const part = normalized.replace(/^customer\./, "").split(".")[0];
    return part || null;
  }

  return normalized.split(".")[0] || null;
};

/**
 * Resolve brand for portal (local + production).
 * Local: ?brandSlug=emrills | ?brandId=1 | header x-customer-host | env CUSTOMER_PORTAL_LOCAL_BRAND_SLUG
 */
export const resolvePortalBrand = async (
  input: PortalBrandResolveInput
): Promise<Brand | null> => {
  if (input.brandId && Number.isFinite(input.brandId)) {
    const byId = await Brand.findOne({
      where: { id: input.brandId, status: "active" },
    });
    if (byId) return byId;
  }

  const slug = (input.brandSlug || "").trim().toLowerCase();
  if (slug) {
    const bySlug = await Brand.findOne({
      where: { slug, status: "active" },
    });
    if (bySlug) return bySlug;
  }

  const host = (input.host || "").trim();
  if (!host) {
    return resolveLocalDefaultBrand();
  }

  const normalized = host.toLowerCase().split(":")[0]!;

  if (LOCAL_HOSTS.has(normalized)) {
    return resolveLocalDefaultBrand();
  }

  const sub = subdomainFromHost(host);
  if (sub) {
    const bySub = await Brand.findOne({
      where: { subdomain: sub, status: "active" },
    });
    if (bySub) return bySub;
    const bySlugSub = await Brand.findOne({
      where: { slug: sub, status: "active" },
    });
    if (bySlugSub) return bySlugSub;
  }

  const brands = await Brand.findAll({ where: { status: "active" } });
  for (const b of brands) {
    const url = (b.customerPortalUrl || "").toLowerCase();
    if (!url) continue;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (u.host === normalized || u.host === host.toLowerCase()) return b;
    } catch {
      if (url.includes(normalized)) return b;
    }
  }

  return null;
};

async function resolveLocalDefaultBrand(): Promise<Brand | null> {
  const envSlug = process.env.CUSTOMER_PORTAL_LOCAL_BRAND_SLUG?.trim();
  if (envSlug) {
    return Brand.findOne({ where: { slug: envSlug, status: "active" } });
  }
  const envId = Number(process.env.CUSTOMER_PORTAL_LOCAL_BRAND_ID);
  if (Number.isFinite(envId) && envId > 0) {
    return Brand.findOne({ where: { id: envId, status: "active" } });
  }
  return Brand.findOne({
    where: { status: "active" },
    order: [["id", "ASC"]],
  });
}

export const readPortalHostFromRequest = (req: {
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
}): PortalBrandResolveInput => {
  const q = req.query || {};
  const body = req.body || {};
  const host =
    String(q.portalHost || q.host || body.host || "").trim() ||
    String(req.headers?.["x-customer-host"] || "").trim();

  const brandIdRaw = q.brandId ?? body.brandId;
  const brandId =
    brandIdRaw != null && brandIdRaw !== ""
      ? Number(brandIdRaw)
      : undefined;

  const brandSlug = String(q.brandSlug ?? body.brandSlug ?? "").trim() || undefined;

  return {
    host: host || undefined,
    brandId: Number.isFinite(brandId) ? brandId : undefined,
    brandSlug,
  };
};

export const isAllowedPortalOrigin = (origin: string): boolean => {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (LOCAL_HOSTS.has(host)) return true;
    if (host.startsWith("customer.")) return true;
    const extra = process.env.CUSTOMER_PORTAL_CORS_HOST_SUFFIXES || "";
    for (const suffix of extra.split(",")) {
      const s = suffix.trim().toLowerCase();
      if (s && host.endsWith(s)) return true;
    }
  } catch {
    return false;
  }
  return false;
};
