import { FindAndCountOptions } from "sequelize";
import { LEAD_LIST_MAX_PAGE_SIZE } from "./leadListQuery";

interface PaginationParams {
  page?: number;
  limit?: number;
}

export const getPagination = ({
  page = 1,
  limit = 10,
}: PaginationParams): { offset: number; limit: number } => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(
    LEAD_LIST_MAX_PAGE_SIZE,
    Math.max(1, Number(limit) || 10),
  );
  const offset = (safePage - 1) * safeLimit;
  return { offset, limit: safeLimit };
};

export const getPagingData = (data: { count: number; rows: any[] }, page: number, limit: number) => {
  const { count: totalItems, rows: dataRows } = data;
  const currentPage = page;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    data: dataRows,
    totalPages,
    currentPage,
  };
};
