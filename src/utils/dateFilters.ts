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
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  switch (filterType) {
    case "today":
    case "daily":
      // Create dates in local time, then convert to UTC
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

      // Convert to UTC for database comparison
      start = new Date(
        localTodayStart.getTime() - now.getTimezoneOffset() * 60000
      );
      end = new Date(localTodayEnd.getTime() - now.getTimezoneOffset() * 60000);
      break;

    case "weekly": {
      // Get start of week (Monday) in local time
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      const localWeekStart = new Date(startOfWeek.setDate(diff));
      localWeekStart.setHours(0, 0, 0, 0);

      // Get end of week (Sunday) in local time
      const localWeekEnd = new Date(localWeekStart);
      localWeekEnd.setDate(localWeekStart.getDate() + 6);
      localWeekEnd.setHours(23, 59, 59, 999);

      // Convert to UTC for database comparison
      start = new Date(
        localWeekStart.getTime() - localWeekStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localWeekEnd.getTime() - localWeekEnd.getTimezoneOffset() * 60000
      );
      break;
    }

    case "monthly":
      // Start of month in local time
      const localMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      // End of month in local time
      const localMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      // Convert to UTC for database comparison
      start = new Date(
        localMonthStart.getTime() - localMonthStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localMonthEnd.getTime() - localMonthEnd.getTimezoneOffset() * 60000
      );
      break;

    case "yearly":
      // Start of year in local time
      const localYearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      // End of year in local time
      const localYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      // Convert to UTC for database comparison
      start = new Date(
        localYearStart.getTime() - localYearStart.getTimezoneOffset() * 60000
      );
      end = new Date(
        localYearEnd.getTime() - localYearEnd.getTimezoneOffset() * 60000
      );
      break;

    case "custom":
      if (startDate && endDate) {
        // For custom dates, assume they're in local time and convert to UTC
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

    default:
      return {}; // no filter
  }

  if (start && end) {
    return {
      createdAt: {
        [Op.between]: [start, end],
      },
    };
  }

  return {};
};
