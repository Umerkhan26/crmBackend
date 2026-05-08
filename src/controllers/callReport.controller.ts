import { Response } from "express";
import { CustomRequest } from "../types/custom";
import {
  getCallReportSummary,
  parseIsoDateRange,
  dayRangeUtc,
  weekRangeUtc,
  monthRangeUtc,
} from "../services/callReport.service";

function parseOptionalUserId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type AdminPeriod = "day" | "week" | "month" | "range";

function resolveAdminRange(query: Record<string, unknown>): {
  from: Date;
  to: Date;
  period: AdminPeriod;
} {
  const raw = (query.period as string)?.toLowerCase().trim();
  if (raw && !["day", "week", "month", "range"].includes(raw)) {
    throw new Error(
      `Unknown period "${query.period}". Use day, week, month, or range (or omit for range).`
    );
  }
  const period: AdminPeriod =
    raw === "day" || raw === "week" || raw === "month" || raw === "range"
      ? raw
      : "range";

  if (period === "day") {
    const date = query.date as string | undefined;
    if (!date || typeof date !== "string") {
      throw new Error(
        "For period=day, query parameter `date` is required (YYYY-MM-DD, UTC day bounds)"
      );
    }
    const { from, to } = dayRangeUtc(date.slice(0, 10));
    return { from, to, period: "day" };
  }

  if (period === "week") {
    const weekStart = query.weekStart as string | undefined;
    if (!weekStart || typeof weekStart !== "string") {
      throw new Error(
        "For period=week, query parameter `weekStart` is required (YYYY-MM-DD, first day in UTC)"
      );
    }
    const { from, to } = weekRangeUtc(weekStart.slice(0, 10));
    return { from, to, period: "week" };
  }

  if (period === "month") {
    const month = query.month as string | undefined;
    if (!month || typeof month !== "string") {
      throw new Error("For period=month, query parameter `month` is required (YYYY-MM)");
    }
    const { from, to } = monthRangeUtc(month);
    return { from, to, period: "month" };
  }

  const { from, to } = parseIsoDateRange(
    query.from as string | undefined,
    query.to as string | undefined,
    60
  );
  return { from, to, period: "range" };
}

export const getMyCallReportController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const { from, to } = req.query as { from?: string; to?: string };
    const range = parseIsoDateRange(from, to, 60);
    const data = await getCallReportSummary({
      userId,
      from: range.from,
      to: range.to,
    });

    res.status(200).json({
      success: true,
      message: "Call report summary",
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to build call report",
    });
  }
};

/**
 * Admin: one endpoint. Query `period`: day | week | month | range (default range).
 * - day: `date=YYYY-MM-DD`
 * - week: `weekStart=YYYY-MM-DD`
 * - month: `month=YYYY-MM`
 * - range: optional `from` / `to` ISO (default last 60 days)
 * Optional `userId` for any period.
 */
export const getAdminCallReportController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userIdQ = (req.query as { userId?: string }).userId;
    const filterUserId = parseOptionalUserId(userIdQ);

    let range: { from: Date; to: Date; period: AdminPeriod };
    try {
      range = resolveAdminRange(req.query as Record<string, unknown>);
    } catch (e: any) {
      res.status(400).json({
        success: false,
        message:
          e?.message ||
          "Invalid query. Use period=day|week|month|range with the matching params (see API docs).",
      });
      return;
    }

    const data = await getCallReportSummary({
      userId: filterUserId,
      from: range.from,
      to: range.to,
    });

    res.status(200).json({
      success: true,
      message: `Admin call report (${range.period}, UTC window)`,
      data: {
        ...data,
        requestedPeriod: range.period,
      },
    });
  } catch (error: any) {
    const status = error?.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error?.message || "Failed to build call report",
    });
  }
};
