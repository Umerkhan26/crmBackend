import { Op } from "sequelize";
import CustomerAccount from "../models/customerAccount.model";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { provisionCustomerFromSale } from "./customerProvisioning.service";

export const listCustomerAccounts = async ({
  page = 1,
  limit = 10,
  search = "",
  brandId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: number;
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const userWhere: any = {};
  if (search.trim()) {
    userWhere[Op.or] = [
      { email: { [Op.like]: `%${search}%` } },
      { firstname: { [Op.like]: `%${search}%` } },
      { lastname: { [Op.like]: `%${search}%` } },
    ];
  }

  const where: any = {};
  if (brandId) where.brandId = brandId;

  const data = await CustomerAccount.findAndCountAll({
    where,
    offset,
    limit: pageLimit,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstname", "lastname", "email", "status"],
        where: Object.keys(userWhere).length ? userWhere : undefined,
        required: !!search.trim(),
      },
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
        required: false,
      },
      {
        model: Lead,
        as: "lead",
        attributes: ["id", "campaignName"],
        required: false,
      },
      {
        model: ProductSale,
        as: "sale",
        attributes: ["id", "status", "conversionDate"],
        required: false,
      },
    ],
  });

  return getPagingData(data, page, pageLimit);
};

export const getCustomerAccountById = async (id: number) => {
  const account = await CustomerAccount.findByPk(id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstname", "lastname", "email", "status", "userrole"],
      },
      { model: Brand, as: "brand", required: false },
      { model: Lead, as: "lead", required: false },
      { model: ProductSale, as: "sale", required: false },
    ],
  });
  if (!account) throw new Error("Customer account not found");
  return account;
};

export const provisionFromSaleId = async (
  saleId: number,
  agentUserId: number,
  brandId?: number
) => {
  const sale = await ProductSale.findByPk(saleId);
  if (!sale?.leadId) throw new Error("Sale or linked lead not found");

  return provisionCustomerFromSale({
    saleId,
    leadId: sale.leadId,
    brandId: brandId ?? sale.brandId ?? null,
    agentUserId,
  });
};
