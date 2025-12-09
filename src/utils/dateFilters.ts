import { Op } from "sequelize";

export type FilterType =
  | "today"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom"
  | "between"
  | "from"
  | "to"
  | "";

export const buildDateFilter = (
  filterType: FilterType,
  startDate?: string,
  endDate?: string
) => {
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  switch (filterType) {
    case "today":
    case "daily":
      const localTodayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );
      const localTodayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );

      start = new Date(
        localTodayStart.getTime() - now.getTimezoneOffset() * 60000
      );
      end = new Date(localTodayEnd.getTime() - now.getTimezoneOffset() * 60000);
      break;

    case "weekly": {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      const localWeekStart = new Date(startOfWeek.setDate(diff));
      localWeekStart.setHours(0, 0, 0, 0);

      const localWeekEnd = new Date(localWeekStart);
      localWeekEnd.setDate(localWeekStart.getDate() + 6);
      localWeekEnd.setHours(23, 59, 59, 999);

      start = new Date(
        localWeekStart.getTime() - localWeekStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localWeekEnd.getTime() - localWeekEnd.getTimezoneOffset() * 60000
      );
      break;
    }

    case "monthly":
      const localMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      const localMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      start = new Date(
        localMonthStart.getTime() - localMonthStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localMonthEnd.getTime() - localMonthEnd.getTimezoneOffset() * 60000
      );
      break;

    case "yearly":
      const localYearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const localYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      start = new Date(
        localYearStart.getTime() - localYearStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localYearEnd.getTime() - localYearEnd.getTimezoneOffset() * 60000
      );
      break;

    // Handle between/from/to cases
    case "between":
    case "custom":
      if (startDate && endDate) {
        const localCustomStart = new Date(`${startDate}T00:00:00`);
        const localCustomEnd = new Date(`${endDate}T23:59:59`);

        start = new Date(
          localCustomStart.getTime() -
            localCustomStart.getTimezoneOffset() * 60000
        );
        end = new Date(
          localCustomEnd.getTime() - localCustomEnd.getTimezoneOffset() * 60000
        );
      }
      break;

    case "from":
      if (startDate) {
        const localFromStart = new Date(`${startDate}T00:00:00`);
        start = new Date(
          localFromStart.getTime() - localFromStart.getTimezoneOffset() * 60000
        );
        // No end date means filter from startDate onward
        end = null;
      }
      break;

    case "to":
      if (endDate) {
        const localToEnd = new Date(`${endDate}T23:59:59`);
        end = new Date(
          localToEnd.getTime() - localToEnd.getTimezoneOffset() * 60000
        );
        // No start date means filter up to endDate
        start = null;
      }
      break;

    case "":
    default:
      return {};
  }

  if (start && end) {
    return {
      createdAt: {
        [Op.between]: [start, end],
      },
    };
  } else if (start) {
    return {
      createdAt: {
        [Op.gte]: start,
      },
    };
  } else if (end) {
    return {
      createdAt: {
        [Op.lte]: end,
      },
    };
  }

  return {};
};
