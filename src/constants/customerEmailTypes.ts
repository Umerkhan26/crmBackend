/**
 * Customer email sender types — loaded dynamically from `customer_email_types` table.
 * Re-exports keep existing imports working across the codebase.
 */
export type CustomerEmailType = string;

export {
  CUSTOMER_EMAIL_FLOW_OPTIONS,
  CUSTOMER_EMAIL_TYPE_DEFAULTS,
  categoryToCustomerEmailType,
  parseCustomerEmailType,
  getDefaultEmailTypeForFlow,
  listCustomerEmailTypes,
  normalizeEmailTypeSlug,
  normalizeMailboxPrefix,
  isMailboxAllowedForEmailType,
  ensureCustomerEmailTypesCache,
  refreshCustomerEmailTypesCache,
  invalidateCustomerEmailTypesCache,
  ensureCustomerEmailTypesSchema,
  seedDefaultCustomerEmailTypes,
} from "../services/customerEmailType.service";

import { getActiveCustomerEmailTypesFromCache } from "../services/customerEmailType.service";
export const CUSTOMER_EMAIL_TYPES = ["care", "invoice", "promotions"] as const;

/** @deprecated Labels come from DB — use listCustomerEmailTypes() */
export const CUSTOMER_EMAIL_TYPE_LABELS: Record<string, string> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      const row = getActiveCustomerEmailTypesFromCache().find(
        (t) => t.slug === prop
      );
      return row?.label || String(prop);
    },
  }
);
