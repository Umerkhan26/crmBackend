import CustomerEmailType, {
  type CustomerEmailFlowKey,
} from "../models/customerEmailType.model";
import BrandEmailSender from "../models/brandEmailSender.model";

export const CUSTOMER_EMAIL_FLOW_OPTIONS: Array<{
  key: CustomerEmailFlowKey;
  label: string;
}> = [
  { key: "credentials", label: "Credentials / password emails" },
  { key: "invoice", label: "Invoice on customer provision" },
  { key: "notification", label: "Customer notifications" },
  { key: "promotional", label: "Promotional category default" },
  { key: "followUp", label: "Follow-up sequences" },
  { key: "bulk", label: "Bulk email default" },
];

const FALLBACK_SLUG = "promotions";

const LEGACY_FLOW_DEFAULTS: Record<string, CustomerEmailFlowKey[]> = {
  care: ["credentials", "notification"],
  invoice: ["invoice"],
  promotions: ["promotional", "followUp", "bulk"],
};

let typesCache: CustomerEmailType[] | null = null;

export const invalidateCustomerEmailTypesCache = (): void => {
  typesCache = null;
};

export const normalizeEmailTypeSlug = (raw: unknown): string =>
  String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");

export const normalizeMailboxPrefix = (
  slug: string,
  rawPrefix?: string | null
): string => {
  const custom = String(rawPrefix || "")
    .trim()
    .toLowerCase();
  if (custom) {
    return custom.endsWith("@") ? custom : `${custom}@`;
  }
  return `${slug}@`;
};

const isValidFlowKey = (key: string): key is CustomerEmailFlowKey =>
  CUSTOMER_EMAIL_FLOW_OPTIONS.some((f) => f.key === key);

const normalizeFlowDefaults = (raw: unknown): CustomerEmailFlowKey[] => {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((v) => String(v).trim()).filter(isValidFlowKey))];
};

export const refreshCustomerEmailTypesCache = async (): Promise<
  CustomerEmailType[]
> => {
  const rows = await CustomerEmailType.findAll({
    order: [
      ["sortOrder", "ASC"],
      ["label", "ASC"],
      ["id", "ASC"],
    ],
  });
  typesCache = rows;
  return rows;
};

export const ensureCustomerEmailTypesCache = async (): Promise<
  CustomerEmailType[]
> => {
  if (typesCache) return typesCache;
  return refreshCustomerEmailTypesCache();
};

export const getCachedCustomerEmailTypes = (): CustomerEmailType[] =>
  typesCache ? [...typesCache] : [];

export const getActiveCustomerEmailTypesFromCache = (): CustomerEmailType[] =>
  getCachedCustomerEmailTypes().filter((t) => t.isActive);

export const getCustomerEmailTypeLabel = (slug: string): string => {
  const row = getCachedCustomerEmailTypes().find((t) => t.slug === slug);
  return row?.label || slug;
};

/** Create customer_email_types table if missing (no alter — avoids MySQL 64-index limit). */
export const ensureCustomerEmailTypesSchema = async (): Promise<void> => {
  try {
    await CustomerEmailType.sync();
  } catch (e: any) {
    const code = e?.original?.code || e?.parent?.code;
    const msg = String(e?.message || e || "");
    if (code === "ER_TOO_MANY_KEYS" || /Too many keys/i.test(msg)) {
      console.warn(
        "⚠️  customer_email_types sync skipped (MySQL max 64 indexes). Drop duplicate indexes, then restart."
      );
      return;
    }
    throw e;
  }
};

export const seedDefaultCustomerEmailTypes = async (): Promise<void> => {
  const defaults = [
    {
      slug: "care",
      label: "Care / support",
      mailboxPrefix: "care@",
      sortOrder: 1,
      flowDefaults: LEGACY_FLOW_DEFAULTS.care,
    },
    {
      slug: "invoice",
      label: "Invoice / billing",
      mailboxPrefix: "invoice@",
      sortOrder: 2,
      flowDefaults: LEGACY_FLOW_DEFAULTS.invoice,
    },
    {
      slug: "promotions",
      label: "Promotions / marketing",
      mailboxPrefix: "promotions@",
      sortOrder: 3,
      flowDefaults: LEGACY_FLOW_DEFAULTS.promotions,
    },
  ];

  for (const row of defaults) {
    const [record] = await CustomerEmailType.findOrCreate({
      where: { slug: row.slug },
      defaults: {
        ...row,
        isActive: true,
      },
    });
    await record.update({
      label: row.label,
      mailboxPrefix: row.mailboxPrefix,
      flowDefaults: row.flowDefaults,
      sortOrder: row.sortOrder,
      isActive: true,
    });
  }
  invalidateCustomerEmailTypesCache();
};

export const listCustomerEmailTypes = async (params?: {
  includeInactive?: boolean;
}) => {
  await ensureCustomerEmailTypesCache();
  const rows = params?.includeInactive
    ? getCachedCustomerEmailTypes()
    : getActiveCustomerEmailTypesFromCache();

  return rows.map((t) => ({
    id: t.id,
    emailType: t.slug,
    slug: t.slug,
    label: t.label,
    mailboxPrefix: t.mailboxPrefix,
    description: t.description,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    flowDefaults: normalizeFlowDefaults(t.flowDefaults),
  }));
};

export const getCustomerEmailTypeBySlug = async (
  slugRaw: string
): Promise<CustomerEmailType | null> => {
  const slug = normalizeEmailTypeSlug(slugRaw);
  if (!slug) return null;
  await ensureCustomerEmailTypesCache();
  return (
    getCachedCustomerEmailTypes().find((t) => t.slug === slug && t.isActive) ||
    null
  );
};

export const parseCustomerEmailType = (
  raw: unknown,
  fallbackSlug: string = FALLBACK_SLUG
): string => {
  const slug = normalizeEmailTypeSlug(raw);
  const active = getActiveCustomerEmailTypesFromCache();
  if (slug && active.some((t) => t.slug === slug)) return slug;

  const fallback = normalizeEmailTypeSlug(fallbackSlug);
  if (fallback && active.some((t) => t.slug === fallback)) return fallback;

  return active[0]?.slug || fallback || FALLBACK_SLUG;
};

export const getDefaultEmailTypeForFlow = (flow: CustomerEmailFlowKey): string => {
  const active = getActiveCustomerEmailTypesFromCache();
  const match = active.find((t) =>
    normalizeFlowDefaults(t.flowDefaults).includes(flow)
  );
  if (match) return match.slug;

  const legacy: Record<CustomerEmailFlowKey, string> = {
    credentials: "care",
    invoice: "invoice",
    notification: "care",
    promotional: "promotions",
    followUp: "promotions",
    bulk: "promotions",
  };
  const slug = legacy[flow];
  if (active.some((t) => t.slug === slug)) return slug;
  return active[0]?.slug || FALLBACK_SLUG;
};

/** @deprecated use getDefaultEmailTypeForFlow — kept for imports */
export const CUSTOMER_EMAIL_TYPE_DEFAULTS = {
  get credentials() {
    return getDefaultEmailTypeForFlow("credentials");
  },
  get invoice() {
    return getDefaultEmailTypeForFlow("invoice");
  },
  get notification() {
    return getDefaultEmailTypeForFlow("notification");
  },
  get promotional() {
    return getDefaultEmailTypeForFlow("promotional");
  },
  get followUp() {
    return getDefaultEmailTypeForFlow("followUp");
  },
  get bulk() {
    return getDefaultEmailTypeForFlow("bulk");
  },
};

export const categoryToCustomerEmailType = (
  category?: string | null
): string => {
  const c = String(category || "")
    .trim()
    .toLowerCase();
  if (c === "invoice" || c === "billing") {
    return getDefaultEmailTypeForFlow("invoice");
  }
  if (c === "care" || c === "support") {
    return getDefaultEmailTypeForFlow("notification");
  }
  if (c === "promotional" || c === "promotions" || c === "marketing") {
    return getDefaultEmailTypeForFlow("promotional");
  }
  return getDefaultEmailTypeForFlow("promotional");
};

export const isMailboxAllowedForEmailType = (
  smtpUser: string,
  emailTypeSlug: string
): boolean => {
  const slug = normalizeEmailTypeSlug(emailTypeSlug);
  const type = getCachedCustomerEmailTypes().find(
    (t) => t.slug === slug && t.isActive
  );
  if (!type) return false;

  const user = String(smtpUser || "").trim().toLowerCase();
  if (!user || user.startsWith("support@")) return false;
  return user.startsWith(type.mailboxPrefix.toLowerCase());
};

export const getActiveMailboxPrefixes = (): string[] =>
  getActiveCustomerEmailTypesFromCache().map((t) =>
    t.mailboxPrefix.toLowerCase()
  );

const stripFlowFromOtherTypes = async (
  flowKeys: CustomerEmailFlowKey[],
  exceptTypeId?: number
) => {
  if (!flowKeys.length) return;
  const all = await CustomerEmailType.findAll();
  for (const row of all) {
    if (exceptTypeId != null && row.id === exceptTypeId) continue;
    const current = normalizeFlowDefaults(row.flowDefaults);
    const next = current.filter((k) => !flowKeys.includes(k));
    if (next.length !== current.length) {
      await row.update({ flowDefaults: next });
    }
  }
};

export const createCustomerEmailType = async (data: {
  slug?: string;
  label: string;
  mailboxPrefix?: string;
  description?: string;
  sortOrder?: number;
  flowDefaults?: CustomerEmailFlowKey[];
}) => {
  const slug = normalizeEmailTypeSlug(data.slug || data.label);
  if (!slug || slug.length < 2) {
    throw new Error("Slug is required (letters/numbers, e.g. sales, noreply)");
  }
  if (!data.label?.trim()) throw new Error("Label is required");

  const existing = await CustomerEmailType.findOne({ where: { slug } });
  if (existing) throw new Error(`Email type "${slug}" already exists`);

  const flowDefaults = normalizeFlowDefaults(data.flowDefaults);
  await stripFlowFromOtherTypes(flowDefaults);

  const created = await CustomerEmailType.create({
    slug,
    label: data.label.trim(),
    mailboxPrefix: normalizeMailboxPrefix(slug, data.mailboxPrefix),
    description: data.description?.trim() || null,
    sortOrder: Number.isFinite(Number(data.sortOrder))
      ? Number(data.sortOrder)
      : 100,
    isActive: true,
    flowDefaults,
  });

  invalidateCustomerEmailTypesCache();
  await refreshCustomerEmailTypesCache();
  return created;
};

export const updateCustomerEmailType = async (
  id: number,
  data: {
    label?: string;
    mailboxPrefix?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    flowDefaults?: CustomerEmailFlowKey[];
  }
) => {
  const row = await CustomerEmailType.findByPk(id);
  if (!row) throw new Error("Email type not found");

  const flowDefaults =
    data.flowDefaults != null
      ? normalizeFlowDefaults(data.flowDefaults)
      : normalizeFlowDefaults(row.flowDefaults);

  if (data.flowDefaults != null) {
    await stripFlowFromOtherTypes(flowDefaults, row.id);
  }

  await row.update({
    ...(data.label != null ? { label: data.label.trim() } : {}),
    ...(data.mailboxPrefix != null
      ? {
          mailboxPrefix: normalizeMailboxPrefix(row.slug, data.mailboxPrefix),
        }
      : {}),
    ...(data.description !== undefined
      ? { description: data.description?.trim() || null }
      : {}),
    ...(data.sortOrder != null && Number.isFinite(Number(data.sortOrder))
      ? { sortOrder: Number(data.sortOrder) }
      : {}),
    ...(data.isActive != null ? { isActive: !!data.isActive } : {}),
    flowDefaults,
  });

  invalidateCustomerEmailTypesCache();
  await refreshCustomerEmailTypesCache();
  return row;
};

export const deactivateCustomerEmailType = async (id: number) => {
  const row = await CustomerEmailType.findByPk(id);
  if (!row) throw new Error("Email type not found");

  const activeCount = await CustomerEmailType.count({
    where: { isActive: true },
  });
  if (row.isActive && activeCount <= 1) {
    throw new Error("At least one active email type is required");
  }

  const senderCount = await BrandEmailSender.count({
    where: { emailType: row.slug, isActive: true },
  });
  if (senderCount > 0) {
    throw new Error(
      `Cannot deactivate — ${senderCount} brand sender(s) still use this type. Deactivate those first.`
    );
  }

  await row.update({ isActive: false });
  invalidateCustomerEmailTypesCache();
  await refreshCustomerEmailTypesCache();
  return row;
};

export type CustomerEmailTypeSlug = string;
