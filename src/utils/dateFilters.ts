import { Op } from "sequelize";

export type FilterType =
  | "today"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export const buildDateFilter = (
  filterType: FilterType,
  startDate?: string,
  endDate?: string
) => {
  const today = new Date();
  let whereClause: any = {};

  switch (filterType) {
    case "today":
    case "daily":
      whereClause = {
        [Op.gte]: new Date(today.setHours(0, 0, 0, 0)),
      };
      break;

    case "weekly":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      whereClause = {
        [Op.gte]: new Date(startOfWeek.setHours(0, 0, 0, 0)),
      };
      break;

    case "monthly":
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      whereClause = {
        [Op.gte]: new Date(startOfMonth.setHours(0, 0, 0, 0)),
      };
      break;

    case "yearly":
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      whereClause = {
        [Op.gte]: new Date(startOfYear.setHours(0, 0, 0, 0)),
      };
      break;

    case "custom":
      if (startDate && endDate) {
        whereClause = {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        };
      }
      break;

    default:
      whereClause = {};
  }

  return {
    createdAt: whereClause,
  };
};
