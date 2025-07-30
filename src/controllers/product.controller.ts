import { Request, Response } from "express";
import * as ProductSaleService from "../services/product.service";

// ✅ Convert Lead to Sale
export const convertLeadToSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const { leadId, productType, price, notes, status } = req.body;
    const createdBy = req.user?.id;

    if (!leadId || !productType || !price) {
      return res.status(400).json({ message: "Missing required sale data." });
    }

    const sale = await ProductSaleService.convertLeadToSale({
      leadId,
      productType,
      price,
      notes,
      status, // Optional
      conversionDate: new Date(),
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Lead converted to sale successfully",
      data: sale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get All Sales
export const getAllSales = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const filters: any = {};
    if (req.query.productType) filters.productType = req.query.productType;
    if (req.query.status) filters.status = req.query.status;

    const salesData = await ProductSaleService.getAllSales({
      page,
      limit,
      search,
      filters,
    });

    return res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      ...salesData,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Sale by ID
export const getSaleById = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await ProductSaleService.getSaleById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Sale fetched successfully",
      data: sale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update Sale
export const updateSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const updatedSale = await ProductSaleService.updateSale(saleId, updatedData, userId);

    return res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Delete Sale
export const deleteSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    await ProductSaleService.deleteSale(saleId, userId);

    return res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Sales by Product Type
export const getSalesByProductType = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({ message: "Product type is required" });
    }

    const sales = await ProductSaleService.getSalesByProductType(type);

    return res.status(200).json({
      success: true,
      message: `Sales fetched for product type: ${type}`,
      data: sales,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
