import { FindAndCountOptions } from "sequelize";

interface PaginationParams {
  page?: number;
  limit?: number;
}

export const getPagination = ({
  page = 1,
  limit = 10,
}: PaginationParams): { offset: number; limit: number } => {
  const offset = (page - 1) * limit;
  return { offset, limit };
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
