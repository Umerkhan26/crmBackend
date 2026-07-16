import fs from "fs";
import path from "path";
import Brand from "../models/brand.model";
import { normalizePortalBaseUrl } from "./portalHost";

/** CRM API path prefix for email template images (see app.ts static mount). */
export const EMAIL_ASSET_ROUTE_PREFIX = "/api/email-assets";

export type CustomerEmailBrandTheme = {
  themeKey: string;
  brandName: string;
  brandLabel: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  mutedColor: string;
  logoUrl: string | null;
  iconUrl: string | null;
  supportEmail: string | null;
  portalUrl: string;
};

export const CUSTOMER_EMAIL_FAVICON_FILES: Record<string, string> = {
  gwb: "GWB.png",
  emrills: "emrills.png",
  dnova: "dnova.png",
  lookforleads: "Looksforleeds.png",
  zronix: "zronix.png",
  ddc: "ddc-logo.png",
  eraxon: "eraxon.png",
};

const SLUG_ALIASES: [string, string[]][] = [
  ["gwb", ["gwb", "globalweb", "globalwebbuilders", "globalwebbuilder"]],
  ["emrills", ["emrill", "emrills"]],
  ["dnova", ["dnova", "donova", "dnovaweb", "dnovawebstudios"]],
  ["lookforleads", ["lookforleads", "lookforleeds", "looksforleeds", "lfl"]],
  ["zronix", ["zronix", "zronixtech"]],
  ["ddc", ["ddc"]],
  ["eraxon", ["eraxon"]],
];

type ThemeBase = Omit<
  CustomerEmailBrandTheme,
  "logoUrl" | "iconUrl" | "supportEmail" | "portalUrl"
>;

const STATIC_THEMES: Record<string, ThemeBase> = {
  gwb: {
    themeKey: "gwb",
    brandName: "GWB",
    brandLabel: "Global Web Builders",
    tagline: "Build. Grow. Succeed.",
    primaryColor: "#ee400a",
    accentColor: "#f55613",
    bgColor: "#fff8f5",
    textColor: "#1a1a1a",
    mutedColor: "#6b5b54",
  },
  emrills: {
    themeKey: "emrills",
    brandName: "Emrills",
    brandLabel: "Emrills",
    tagline: "Healthcare solutions that care.",
    primaryColor: "#272827",
    accentColor: "#d0202d",
    bgColor: "#f6f6f6",
    textColor: "#272827",
    mutedColor: "#5a5a5a",
  },
  dnova: {
    themeKey: "dnova",
    brandName: "Dnova",
    brandLabel: "Dnova Web Studios",
    tagline: "Digital experiences that deliver.",
    primaryColor: "#141414",
    accentColor: "#BA2222",
    bgColor: "#f7f7f7",
    textColor: "#141414",
    mutedColor: "#5c5c5c",
  },
  lookforleads: {
    themeKey: "lookforleads",
    brandName: "Look for Leeds",
    brandLabel: "Look for Leeds",
    tagline: "Leads that convert.",
    primaryColor: "#0C27BC",
    accentColor: "#A3CE38",
    bgColor: "#f5f7f2",
    textColor: "#333131",
    mutedColor: "#5a5a62",
  },
};

/** Public URL where CRM serves email assets via /api/email-assets. */
export const getCustomerEmailAssetBaseUrl = (): string => {
  const explicit =
    process.env.CUSTOMER_EMAIL_ASSET_BASE_URL?.trim() ||
    process.env.CUSTOMER_PORTAL_EMAIL_ASSET_BASE_URL?.trim();
  if (explicit) return normalizePortalBaseUrl(explicit);

  const backendPublic =
    process.env.BACKEND_PUBLIC_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim();
  if (backendPublic) return normalizePortalBaseUrl(backendPublic);

  // CRM API is served on the same host as the frontend (e.g. https://xcrm.live/api/...).
  const frontEnd = process.env.FRONT_END_URL?.trim();
  if (frontEnd) return normalizePortalBaseUrl(frontEnd);

  const port = process.env.PORT || "3000";
  const fallback = `http://localhost:${port}`;
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) {
    console.error(
      "[email] BACKEND_PUBLIC_URL / FRONT_END_URL not set — open-tracking pixels will use localhost and will NOT work from Gmail. Set BACKEND_PUBLIC_URL=https://xcrm.live"
    );
  }
  return fallback;
};

const assetBaseUrl = (): string => getCustomerEmailAssetBaseUrl();

/** Map legacy portal paths to CRM email-assets route. */
export const normalizeEmailAssetPath = (rawPath?: string | null): string | null => {
  const raw = String(rawPath || "").trim();
  if (!raw) return null;
  if (raw.startsWith(EMAIL_ASSET_ROUTE_PREFIX)) return raw;
  if (raw.startsWith("/Favicons/")) return `${EMAIL_ASSET_ROUTE_PREFIX}${raw}`;
  if (raw.startsWith("/brands/")) return `${EMAIL_ASSET_ROUTE_PREFIX}${raw}`;
  if (raw.startsWith("Favicons/")) return `${EMAIL_ASSET_ROUTE_PREFIX}/${raw}`;
  if (raw.startsWith("brands/")) return `${EMAIL_ASSET_ROUTE_PREFIX}/${raw}`;
  return raw;
};

export const toAbsoluteAssetUrl = (path?: string | null): string | null => {
  const normalized = normalizeEmailAssetPath(path);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const base = assetBaseUrl().replace(/\/$/, "");
  return `${base}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

export const resolveCustomerEmailThemeKey = (brand?: {
  slug?: string | null;
  subdomain?: string | null;
  name?: string | null;
} | null): string => {
  if (!brand) return "gwb";
  const raw = [brand.slug, brand.subdomain, brand.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  for (const [key, aliases] of SLUG_ALIASES) {
    if (aliases.some((a) => raw.includes(a.replace(/[^a-z0-9]/g, "")))) {
      return key;
    }
  }
  return "gwb";
};

const defaultLogoPath = (themeKey: string): string | null => {
  if (!themeKey) return null;
  return `${EMAIL_ASSET_ROUTE_PREFIX}/brands/${themeKey}/logo.png`;
};

const defaultIconPath = (themeKey: string): string | null => {
  const file = CUSTOMER_EMAIL_FAVICON_FILES[themeKey];
  return file ? `${EMAIL_ASSET_ROUTE_PREFIX}/Favicons/${file}` : null;
};

const resolveEmailIconPath = (
  themeKey: string,
  faviconOverride?: string | null
): string | null => {
  const canonical = defaultIconPath(themeKey);
  if (canonical) return canonical;

  const override = normalizeEmailAssetPath(faviconOverride);
  if (override) return override;

  return defaultLogoPath(themeKey);
};

export const buildCustomerEmailBrandTheme = (
  themeKey: string,
  overrides?: {
    logoUrl?: string | null;
    faviconUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    supportEmail?: string | null;
    brandLabel?: string | null;
    brandName?: string | null;
  }
): CustomerEmailBrandTheme => {
  const base = STATIC_THEMES[themeKey] || STATIC_THEMES.gwb;
  const logoUrl = toAbsoluteAssetUrl(
    normalizeEmailAssetPath(overrides?.logoUrl) || defaultLogoPath(themeKey)
  );
  const iconUrl = toAbsoluteAssetUrl(
    resolveEmailIconPath(themeKey, overrides?.faviconUrl)
  );

  return {
    ...base,
    brandLabel: overrides?.brandLabel?.trim() || base.brandLabel,
    brandName: overrides?.brandName?.trim() || base.brandName,
    primaryColor: overrides?.primaryColor?.trim() || base.primaryColor,
    accentColor: overrides?.accentColor?.trim() || base.accentColor,
    logoUrl,
    iconUrl,
    supportEmail: overrides?.supportEmail?.trim() || null,
    portalUrl: normalizePortalBaseUrl(),
  };
};

export const getCustomerEmailBrandThemeFromBrand = (
  brand?: Brand | null
): CustomerEmailBrandTheme => {
  if (!brand) return buildCustomerEmailBrandTheme("gwb");

  const themeKey = resolveCustomerEmailThemeKey(brand);
  const salesFormConfig = (brand.salesFormConfig || {}) as Record<string, unknown>;
  const portalTheme = (salesFormConfig.portalTheme || {}) as Record<string, unknown>;

  return buildCustomerEmailBrandTheme(themeKey, {
    logoUrl: (portalTheme.logoUrl as string) || null,
    faviconUrl: (portalTheme.faviconUrl as string) || null,
    primaryColor: (portalTheme.primaryColor as string) || null,
    accentColor: (portalTheme.accentColor as string) || null,
    supportEmail: (portalTheme.supportEmail as string) || null,
    brandLabel: brand.name || null,
  });
};

export const getCustomerEmailBrandTheme = async (
  brandId?: number | null
): Promise<CustomerEmailBrandTheme> => {
  if (!brandId) return buildCustomerEmailBrandTheme("gwb");
  const brand = await Brand.findByPk(brandId);
  return getCustomerEmailBrandThemeFromBrand(brand);
};

/** Email header — favicon + brand text. */
export const getCustomerEmailHeaderImage = (
  theme: CustomerEmailBrandTheme
): { url: string; variant: "logo" | "icon" } | null => {
  if (theme.iconUrl) return { url: theme.iconUrl, variant: "icon" };
  if (theme.logoUrl) return { url: theme.logoUrl, variant: "logo" };
  return null;
};

export const resolveEmailHeaderImageSrc = (
  theme: CustomerEmailBrandTheme
): { src: string; variant: "logo" | "icon" } | null => {
  const header = getCustomerEmailHeaderImage(theme);
  if (!header) return null;
  return { src: header.url, variant: header.variant };
};
