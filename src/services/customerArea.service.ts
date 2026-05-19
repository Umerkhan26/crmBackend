import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import CustomerAccount from "../models/customerAccount.model";
import Role from "../models/role.model";
import ProductSale from "../models/product.model";
import Lead from "../models/lead.model";

export const resolveBrandByHost = async (
  host: string
): Promise<Brand | null> => {
  const normalized = (host || "").toLowerCase().split(":")[0]!;
  const subdomain = normalized.startsWith("customer.")
    ? normalized.replace(/^customer\./, "").split(".")[0]
    : normalized.split(".")[0];

  if (!subdomain) return null;

  const brand = await Brand.findOne({
    where: { subdomain, status: "active" },
  });
  return brand;
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
}) => {
  const { email, password, brandId, host } = params;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  let resolvedBrandId = brandId;
  if (!resolvedBrandId && host) {
    const brand = await resolveBrandByHost(host);
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

  if (resolvedBrandId) {
    const account = await CustomerAccount.findOne({
      where: { userId: user.id, brandId: resolvedBrandId, status: "active" },
    });
    if (!account) {
      throw new Error("No customer account for this brand");
    }
  } else {
    const anyAccount = await CustomerAccount.findOne({
      where: { userId: user.id, status: "active" },
    });
    if (!anyAccount) {
      throw new Error("No customer account found");
    }
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      userrole: "customer",
      brandId: resolvedBrandId ?? user.brandId,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  await user.update({ last_login: new Date() });

  return {
    token,
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      brandId: resolvedBrandId ?? user.brandId,
    },
  };
};

export const getCustomerProfile = async (userId: number) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "firstname", "lastname", "email", "brandId", "userrole"],
  });
  if (!user) throw new Error("User not found");

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

  return { user, accounts };
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
