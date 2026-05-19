import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerAccountService from "../services/customerAccount.service";

export const listCustomerAccountsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const brandId = req.query.brandId
      ? parseInt(req.query.brandId as string)
      : undefined;

    const data = await CustomerAccountService.listCustomerAccounts({
      page,
      limit,
      search,
      brandId,
    });

    return res.status(200).json({
      success: true,
      message: "Customer accounts fetched",
      ...data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerAccountByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const account = await CustomerAccountService.getCustomerAccountById(id);
    return res.status(200).json({ success: true, data: account });
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const provisionCustomerFromSaleController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const saleId = parseInt(req.params.saleId, 10);
    if (isNaN(saleId)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }
    const brandId = req.body.brandId
      ? parseInt(req.body.brandId, 10)
      : undefined;

    const result = await CustomerAccountService.provisionFromSaleId(
      saleId,
      req.user!.id,
      brandId
    );

    return res.status(200).json({
      success: true,
      message: result.provisioned
        ? "Customer account created"
        : "Customer account not created",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
