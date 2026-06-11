import jwt from "jsonwebtoken";

export const PORTAL_CUSTOMER_TOKEN_TYPE = "portal_customer";

export type PortalCustomerTokenPayload = {
  id: number;
  email: string;
  brandId?: number;
  tokenType: typeof PORTAL_CUSTOMER_TOKEN_TYPE;
};

export const signPortalCustomerToken = (payload: {
  id: number;
  email: string;
  brandId: number;
}) =>
  jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      brandId: payload.brandId,
      tokenType: PORTAL_CUSTOMER_TOKEN_TYPE,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

export const decodePortalCustomerToken = (
  token: string
): PortalCustomerTokenPayload | null => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as PortalCustomerTokenPayload;
    if (decoded?.tokenType !== PORTAL_CUSTOMER_TOKEN_TYPE) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const isPortalCustomerToken = (token: string): boolean =>
  decodePortalCustomerToken(token) != null;
