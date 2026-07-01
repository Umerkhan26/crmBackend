/** Customer-facing sender mailboxes (brand-configurable). */
export const CUSTOMER_EMAIL_TYPES = ["care", "invoice", "promotions"] as const;

export type CustomerEmailType = (typeof CUSTOMER_EMAIL_TYPES)[number];

export const CUSTOMER_EMAIL_TYPE_LABELS: Record<CustomerEmailType, string> = {
  care: "Care / support",
  invoice: "Invoice / billing",
  promotions: "Promotions / marketing",
};

/** Automated flows → default sender type */
export const CUSTOMER_EMAIL_TYPE_DEFAULTS = {
  credentials: "care",
  invoice: "invoice",
  notification: "care",
  promotional: "promotions",
  followUp: "promotions",
  bulk: "promotions",
} as const satisfies Record<string, CustomerEmailType>;

export const parseCustomerEmailType = (
  raw: unknown,
  fallback: CustomerEmailType = "promotions"
): CustomerEmailType => {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if ((CUSTOMER_EMAIL_TYPES as readonly string[]).includes(v)) {
    return v as CustomerEmailType;
  }
  return fallback;
};

/** Map legacy `category` strings to sender type */
export const categoryToCustomerEmailType = (
  category?: string | null
): CustomerEmailType => {
  const c = String(category || "")
    .trim()
    .toLowerCase();
  if (c === "invoice" || c === "billing") return "invoice";
  if (c === "care" || c === "support") return "care";
  if (c === "promotional" || c === "promotions" || c === "marketing") {
    return "promotions";
  }
  return CUSTOMER_EMAIL_TYPE_DEFAULTS.promotional;
};
