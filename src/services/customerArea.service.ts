import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import CustomerAccount from "../models/customerAccount.model";
import Role from "../models/role.model";
import ProductSale from "../models/product.model";
import Lead from "../models/lead.model";
import { resolvePortalBrand } from "../utils/portalHost";
import { logPortalActivityFromContext } from "./portalActivity.service";

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const resolveBrandByHost = async (
  host: string,
  opts?: { brandId?: number; brandSlug?: string }
): Promise<Brand | null> => {
  return resolvePortalBrand({
    host,
    brandId: opts?.brandId,
    brandSlug: opts?.brandSlug,
  });
};

export const getPortalBrands = async () => {
  return Brand.findAll({
    where: { status: "active" },
    attributes: [
      "id",
      "name",
      "slug",
      "subdomain",
      "customerPortalUrl",
      "defaultCampaignId",
      "salesFormConfig",
    ],
    order: [["name", "ASC"]],
  });
};

export const getBrandSalesForm = async (brandId: number) => {
  const brand = await Brand.findByPk(brandId, {
    attributes: [
      "id",
      "name",
      "slug",
      "subdomain",
      "customerPortalUrl",
      "defaultCampaignId",
      "salesFormConfig",
    ],
  });
  if (!brand) throw new Error("Brand not found");
  return brand;
};

export const customerLogin = async (params: {
  email: string;
  password: string;
  brandId?: number;
  host?: string;
  brandSlug?: string;
}) => {
  const { email, password, brandId, host, brandSlug } = params;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const slug = (brandSlug || "").trim().toLowerCase();
  const hostname = (host || "").toLowerCase().split(":")[0] || "";

  let resolvedBrandId =
    brandId != null && Number.isFinite(Number(brandId))
      ? Number(brandId)
      : undefined;

  if (!resolvedBrandId && slug) {
    const bySlug = await Brand.findOne({
      where: { slug, status: "active" },
    });
    resolvedBrandId = bySlug?.id;
  }

  if (!resolvedBrandId && hostname && !LOCAL_DEV_HOSTS.has(hostname)) {
    const brand = await resolveBrandByHost(host || "", { brandSlug: slug });
    resolvedBrandId = brand?.id;
  }

  const user = await User.findOne({
    where: { email },
    include: [{ model: Role, as: "role", attributes: ["id", "name"] }],
  });

  if (!user || !user.password) {
    throw new Error("Invalid credentials");
  }

  const roleName = (user.userrole || user.role?.name || "").toLowerCase();
  if (roleName !== "customer" && roleName !== "client") {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const accounts = await CustomerAccount.findAll({
    where: { userId: user.id, status: "active" },
    order: [["id", "ASC"]],
  });

  if (!accounts.length) {
    throw new Error("No customer account found");
  }

  let account =
    resolvedBrandId != null
      ? accounts.find((a) => a.brandId === resolvedBrandId)
      : undefined;

  if (!account) {
    if (resolvedBrandId != null && accounts.length === 1) {
      account = accounts[0];
    } else if (resolvedBrandId != null) {
      throw new Error("No customer account for this brand");
    } else {
      account = accounts[0];
    }
  }

  const accountBrandId = account.brandId;
  if (accountBrandId == null || !Number.isFinite(Number(accountBrandId))) {
    throw new Error("Customer account has no brand");
  }
  resolvedBrandId = Number(accountBrandId);

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      userrole: "customer",
      brandId: resolvedBrandId,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  await user.update({
    last_login: new Date(),
    brandId: resolvedBrandId,
  });

  void logPortalActivityFromContext(
    account,
    Number(user.id),
    "login",
    { metadata: { brandId: resolvedBrandId, email: user.email } }
  );

  return {
    token,
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      brandId: resolvedBrandId,
    },
  };
};

export const getCustomerProfile = async (
  userId: number,
  activeBrandId?: number
) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "firstname", "lastname", "email", "brandId", "userrole"],
  });
  if (!user) throw new Error("User not found");

  const effectiveBrandId =
    activeBrandId && Number.isFinite(activeBrandId)
      ? activeBrandId
      : user.brandId;

  const accounts = await CustomerAccount.findAll({
    where: { userId, status: "active" },
    include: [
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug", "customerPortalUrl", "subdomain"],
      },
    ],
  });

  const userJson = user.toJSON() as Record<string, unknown>;
  if (effectiveBrandId != null) {
    userJson.brandId = effectiveBrandId;
  }

  return { user: userJson, accounts };
};

export const getCustomerSaleSummary = async (userId: number) => {
  const accounts = await CustomerAccount.findAll({
    where: { userId, status: "active" },
    attributes: ["id", "brandId", "leadId", "saleId"],
  });

  const saleIds = accounts.map((a) => a.saleId).filter(Boolean) as number[];
  const leadIds = accounts.map((a) => a.leadId).filter(Boolean) as number[];

  const sales = saleIds.length
    ? await ProductSale.findAll({
        where: { id: saleIds },
        attributes: [
          "id",
          "leadId",
          "productType",
          "price",
          "status",
          "conversionDate",
          "products",
          "brandId",
        ],
      })
    : [];

  const leads = leadIds.length
    ? await Lead.findAll({
        where: { id: leadIds },
        attributes: ["id", "campaignName", "leadData", "brandId"],
      })
    : [];

  return { accounts, sales, leads };
};
