import Brand from "../models/brand.model";
import { normalizePortalBaseUrl } from "./portalHost";

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

const FAVICON_FILE: Record<string, string> = {
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

const PRODUCTION_EMAIL_ASSET_BASE = "https://customerarea.live";

const assetBaseUrl = (): string => {
  const explicit = process.env.CUSTOMER_PORTAL_EMAIL_ASSET_BASE_URL?.trim();
  if (explicit) return normalizePortalBaseUrl(explicit);

  const base = normalizePortalBaseUrl();
  if (/localhost|127\.0\.0\.1/i.test(base)) {
    return PRODUCTION_EMAIL_ASSET_BASE;
  }
  return base;
};

export const toAbsoluteAssetUrl = (path?: string | null): string | null => {
  const raw = String(path || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = assetBaseUrl().replace(/\/$/, "");
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
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
  if (themeKey === "emrills") return "/brands/emrills/logo.png";
  return null;
};

const defaultIconPath = (themeKey: string): string | null => {
  const file = FAVICON_FILE[themeKey];
  return file ? `/Favicons/${file}` : null;
};

/** Known brands always use canonical favicon filename (case-sensitive on server). */
const resolveEmailIconPath = (
  themeKey: string,
  faviconOverride?: string | null
): string | null => {
  const canonical = defaultIconPath(themeKey);
  if (canonical) return canonical;

  const override = String(faviconOverride || "").trim();
  if (override) return override;

  return `/brands/${themeKey}/logo.png`;
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
    overrides?.logoUrl || defaultLogoPath(themeKey)
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
    portalUrl: assetBaseUrl(),
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

/** Header image — square favicon preferred (wordmark logos look poor in email headers). */
export const getCustomerEmailHeaderImage = (
  theme: CustomerEmailBrandTheme
): { url: string; isSquare: boolean } | null => {
  if (theme.iconUrl) return { url: theme.iconUrl, isSquare: true };

  const brandLogo = toAbsoluteAssetUrl(`/brands/${theme.themeKey}/logo.png`);
  if (brandLogo) return { url: brandLogo, isSquare: false };

  if (theme.logoUrl) return { url: theme.logoUrl, isSquare: false };
  return null;
};
