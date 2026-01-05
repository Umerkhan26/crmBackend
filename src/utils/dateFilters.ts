import { Op } from "sequelize";

export type FilterType =
  | "today"
  | "daily"
  | "yesterday"
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
    case "daily": {
      // Get today's date boundaries in local timezone, then convert to UTC
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      
      // Create start and end of day in local timezone
      const localStart = new Date(year, month, day, 0, 0, 0, 0);
      const localEnd = new Date(year, month, day, 23, 59, 59, 999);
      
      // Convert to UTC: getTimezoneOffset() returns minutes difference from UTC
      // For UTC+5 (Pakistan): offset = -300, so UTC = Local - (-300) = Local + 300 minutes
      // For UTC-5 (US EST): offset = +300, so UTC = Local - 300 minutes
      // Formula: UTC = Local - offset (in milliseconds)
      const offsetMs = localStart.getTimezoneOffset() * 60000;
      start = new Date(localStart.getTime() - offsetMs);
      end = new Date(localEnd.getTime() - offsetMs);
      break;
    }

    case "yesterday": {
      // Get yesterday's date boundaries in local timezone, then convert to UTC
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      
      // Create start and end of yesterday in local timezone
      const localStart = new Date(year, month, day - 1, 0, 0, 0, 0);
      const localEnd = new Date(year, month, day - 1, 23, 59, 59, 999);
      
      // Convert to UTC
      const offsetMs = localStart.getTimezoneOffset() * 60000;
      start = new Date(localStart.getTime() - offsetMs);
      end = new Date(localEnd.getTime() - offsetMs);
      break;
    }

    case "weekly": {
      // Get start of week (Monday) in local timezone
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      const dayOfWeek = now.getDay();
      
      // Calculate Monday (day 1, where Sunday is 0)
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayDate = new Date(year, month, day + mondayOffset, 0, 0, 0, 0);
      const sundayDate = new Date(year, month, day + mondayOffset + 6, 23, 59, 59, 999);
      
      // Convert to UTC
      const offsetMs = mondayDate.getTimezoneOffset() * 60000;
      start = new Date(mondayDate.getTime() - offsetMs);
      end = new Date(sundayDate.getTime() - offsetMs);
      break;
    }

    case "monthly": {
      // Get first and last day of current month in local timezone
      const year = now.getFullYear();
      const month = now.getMonth();
      
      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      // Convert to UTC
      const offsetMs = monthStart.getTimezoneOffset() * 60000;
      start = new Date(monthStart.getTime() - offsetMs);
      end = new Date(monthEnd.getTime() - offsetMs);
      break;
    }

    case "yearly": {
      const year = now.getFullYear();
      const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      
      // Convert to UTC
      const offsetMs = yearStart.getTimezoneOffset() * 60000;
      start = new Date(yearStart.getTime() - offsetMs);
      end = new Date(yearEnd.getTime() - offsetMs);
      break;
    }

    // Handle between/from/to cases
    case "between":
    case "custom":
      if (startDate && endDate) {
        // Parse dates as local dates, then convert to UTC
        const localCustomStart = new Date(`${startDate}T00:00:00`);
        const localCustomEnd = new Date(`${endDate}T23:59:59`);
        
        const offsetMsStart = localCustomStart.getTimezoneOffset() * 60000;
        const offsetMsEnd = localCustomEnd.getTimezoneOffset() * 60000;
        start = new Date(localCustomStart.getTime() - offsetMsStart);
        end = new Date(localCustomEnd.getTime() - offsetMsEnd);
      }
      break;

    case "from":
      if (startDate) {
        const localFromStart = new Date(`${startDate}T00:00:00`);
        const offsetMs = localFromStart.getTimezoneOffset() * 60000;
        start = new Date(localFromStart.getTime() - offsetMs);
        // No end date means filter from startDate onward
        end = null;
      }
      break;

    case "to":
      if (endDate) {
        const localToEnd = new Date(`${endDate}T23:59:59`);
        const offsetMs = localToEnd.getTimezoneOffset() * 60000;
        end = new Date(localToEnd.getTime() - offsetMs);
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
