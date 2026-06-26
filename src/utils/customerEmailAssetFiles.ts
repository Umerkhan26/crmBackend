import fs from "fs";
import path from "path";
import {
  CUSTOMER_EMAIL_FAVICON_FILES,
  type CustomerEmailBrandTheme,
  getCustomerEmailHeaderImage,
} from "./customerEmailBrandTheme";

/** CID referenced in email HTML for the brand favicon/logo. */
export const CUSTOMER_EMAIL_HEADER_CID = "customer-brand-icon@crm";

const emailAssetsCandidates = (): string[] => [
  path.join(process.cwd(), "public"),
  path.join(__dirname, "..", "..", "public"),
  path.join(__dirname, "..", "..", "..", "public"),
];

/** CRM folder: crmBackend/public (contains Favicons/). */
export const getEmailAssetsPublicDir = (): string => {
  const found = emailAssetsCandidates().find((dir) =>
    fs.existsSync(path.join(dir, "Favicons"))
  );
  return found || emailAssetsCandidates()[0];
};

export const resolveLocalEmailHeaderImagePath = (
  theme: CustomerEmailBrandTheme
): string | null => {
  const baseDir = getEmailAssetsPublicDir();
  const faviconFile = CUSTOMER_EMAIL_FAVICON_FILES[theme.themeKey];
  if (faviconFile) {
    const faviconPath = path.join(baseDir, "Favicons", faviconFile);
    if (fs.existsSync(faviconPath)) return faviconPath;
  }

  const logoPath = path.join(baseDir, "brands", theme.themeKey, "logo.png");
  if (fs.existsSync(logoPath)) return logoPath;

  return null;
};

export type CustomerEmailHeaderDelivery = {
  headerImageSrc: string;
  attachment?: {
    filename: string;
    path: string;
    cid: string;
  };
};

/** Prefer local CRM file (CID inline) so emails work without public HTTP URL. */
export const getCustomerEmailHeaderDelivery = (
  theme: CustomerEmailBrandTheme
): CustomerEmailHeaderDelivery | null => {
  const localPath = resolveLocalEmailHeaderImagePath(theme);
  if (localPath) {
    return {
      headerImageSrc: `cid:${CUSTOMER_EMAIL_HEADER_CID}`,
      attachment: {
        filename: path.basename(localPath),
        path: localPath,
        cid: CUSTOMER_EMAIL_HEADER_CID,
      },
    };
  }

  const header = getCustomerEmailHeaderImage(theme);
  if (!header?.url) return null;
  return { headerImageSrc: header.url };
};

/** Swap remote header image URL for CID when attaching local CRM favicon. */
export const applyCustomerEmailHeaderDelivery = (
  html: string,
  theme: CustomerEmailBrandTheme,
  delivery: CustomerEmailHeaderDelivery
): string => {
  if (!delivery.attachment) return html;

  const header = getCustomerEmailHeaderImage(theme);
  if (!header?.url || header.url === delivery.headerImageSrc) {
    return html;
  }

  return html.split(header.url).join(delivery.headerImageSrc);
};
