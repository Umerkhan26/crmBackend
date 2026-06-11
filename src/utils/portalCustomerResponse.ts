/** CRM APIs historically expose portal identity as `user`; keep that shape for clients. */
export const attachPortalCustomerAsUser = <T extends Record<string, unknown>>(
  row: T
): T & { user?: Record<string, unknown> } => {
  const portalCustomer = row.portalCustomer as Record<string, unknown> | undefined;
  if (portalCustomer && !row.user) {
    (row as T & { user?: Record<string, unknown> }).user = portalCustomer;
  }
  return row as T & { user?: Record<string, unknown> };
};

export const mapPortalCustomerAsUser = <T extends Record<string, unknown>>(
  rows: T[]
): T[] => rows.map((row) => attachPortalCustomerAsUser({ ...row }));

export const serializeCustomerAccount = (account: unknown) => {
  const plain =
    account &&
    typeof account === "object" &&
    "get" in account &&
    typeof (account as { get: (opts: { plain: boolean }) => unknown }).get ===
      "function"
      ? ((account as { get: (opts: { plain: boolean }) => Record<string, unknown> }).get(
          { plain: true }
        ))
      : ({ ...(account as Record<string, unknown>) });
  return attachPortalCustomerAsUser(plain);
};
