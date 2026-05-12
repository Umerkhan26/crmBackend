import { Response } from "express";
import { Op } from "sequelize";
import { CustomRequest } from "../types/custom";
import User from "../models/user.model";
import Role from "../models/role.model";
import {
  getCallReportByUserPage,
  getCallReportSummary,
  listReportCalls,
  resolveAdminReportRange,
  resolveUserReportRange,
} from "../services/callReport.service";
import { getManagerBrandUserIds, isUserManager } from "../utils/brandUtils";

function parseOptionalUserId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function callReportWindowLabel(period: string): string {
  if (period === "today" || period === "yesterday") {
    return "Asia/Karachi night shift (18:00–07:00)";
  }
  return "UTC calendar window";
}

/** Same role gate as `requireAdmin`: org-wide report on user-scoped routes if misrouted. */
async function isSuperAdminUser(uid: number): Promise<boolean> {
  const user = (await User.findByPk(uid, {
    include: [{ model: Role, as: "role" }],
  })) as any;
  const roleName = (user?.role?.name || "").toLowerCase().trim();
  return roleName === "admin" || roleName === "adminn";
}

/** Who can appear in the call-report user filter (strict admins use getAllUsers on the client). */
export const getCallReportAssigneesController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const user = (await User.findByPk(userId, {
      include: [{ model: Role, as: "role" }],
    })) as any;

    const roleName = (user?.role?.name || "").toLowerCase().trim();
    const isSuperAdmin = roleName === "admin" || roleName === "adminn";
    if (isSuperAdmin) {
      res.status(200).json({
        success: true,
        message: "Assignees",
        data: { scope: "org", users: [] },
      });
      return;
    }

    if (await isUserManager(userId)) {
      const ids = await getManagerBrandUserIds(userId);
      if (ids.length === 0) {
        res.status(200).json({
          success: true,
          message: "Assignees",
          data: { scope: "team", users: [] },
        });
        return;
      }
      const rows = await User.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ["id", "firstname", "lastname", "email"],
        order: [
          ["firstname", "ASC"],
          ["lastname", "ASC"],
          ["id", "ASC"],
        ],
      });
      res.status(200).json({
        success: true,
        message: "Assignees",
        data: {
          scope: "team",
          users: rows.map((r) => r.get({ plain: true })),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Assignees",
      data: { scope: "self", users: [] },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to load assignees",
    });
  }
};

export const getMyCallReportController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const filterUserId = parseOptionalUserId((req.query as { userId?: string }).userId);
    const range = resolveUserReportRange(req.query as { period?: string; from?: string; to?: string });

    if (await isSuperAdminUser(userId)) {
      const data = await getCallReportSummary({
        userId: filterUserId,
        from: range.from,
        to: range.to,
      });
      res.status(200).json({
        success: true,
        message: "Call report summary",
        data: {
          ...data,
          requestedPeriod: range.requestedPeriod,
        },
      });
      return;
    }

    const isMgr = await isUserManager(userId);
    if (isMgr) {
      const team = await getManagerBrandUserIds(userId);
      if (filterUserId != null && !team.includes(filterUserId)) {
        res.status(403).json({
          success: false,
          message: "That user is not assigned to your brands.",
        });
        return;
      }
      const data = await getCallReportSummary({
        from: range.from,
        to: range.to,
        ...(filterUserId != null ? { userId: filterUserId } : { userIds: team }),
      });

      res.status(200).json({
        success: true,
        message: "Call report summary",
        data: {
          ...data,
          requestedPeriod: range.requestedPeriod,
        },
      });
      return;
    }

    if (filterUserId != null && filterUserId !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only view your own call report.",
      });
      return;
    }

    const data = await getCallReportSummary({
      userId,
      from: range.from,
      to: range.to,
    });

    res.status(200).json({
      success: true,
      message: "Call report summary",
      data: {
        ...data,
        requestedPeriod: range.requestedPeriod,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to build call report",
    });
  }
};

/** Paginated outbound calls in the report window (same filters as summary). */
export const getMyCallReportCallsController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const { page, limit } = req.query as {
      page?: string;
      limit?: string;
    };
    const filterUserId = parseOptionalUserId((req.query as { userId?: string }).userId);
    const range = resolveUserReportRange(req.query as { period?: string; from?: string; to?: string });

    if (await isSuperAdminUser(userId)) {
      const data = await listReportCalls({
        userId: filterUserId,
        from: range.from,
        to: range.to,
        page: page != null ? Number(page) : 1,
        limit: limit != null ? Number(limit) : 20,
      });
      res.status(200).json({
        success: true,
        message: "Call report calls (paginated)",
        data: {
          period: { from: range.from.toISOString(), to: range.to.toISOString() },
          requestedPeriod: range.requestedPeriod,
          ...data,
        },
      });
      return;
    }

    const isMgr = await isUserManager(userId);
    if (isMgr) {
      const team = await getManagerBrandUserIds(userId);
      if (filterUserId != null && !team.includes(filterUserId)) {
        res.status(403).json({
          success: false,
          message: "That user is not assigned to your brands.",
        });
        return;
      }
      const data = await listReportCalls({
        from: range.from,
        to: range.to,
        page: page != null ? Number(page) : 1,
        limit: limit != null ? Number(limit) : 20,
        ...(filterUserId != null ? { userId: filterUserId } : { userIds: team }),
      });

      res.status(200).json({
        success: true,
        message: "Call report calls (paginated)",
        data: {
          period: { from: range.from.toISOString(), to: range.to.toISOString() },
          requestedPeriod: range.requestedPeriod,
          ...data,
        },
      });
      return;
    }

    if (filterUserId != null && filterUserId !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only view your own calls.",
      });
      return;
    }

    const data = await listReportCalls({
      userId,
      from: range.from,
      to: range.to,
      page: page != null ? Number(page) : 1,
      limit: limit != null ? Number(limit) : 20,
    });

    res.status(200).json({
      success: true,
      message: "Call report calls (paginated)",
      data: {
        period: { from: range.from.toISOString(), to: range.to.toISOString() },
        requestedPeriod: range.requestedPeriod,
        ...data,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to list calls",
    });
  }
};

/**
 * Admin: one endpoint. Query `period`: day | week | month | range | today | yesterday (default range).
 * - day: `date=YYYY-MM-DD`
 * - week: `weekStart=YYYY-MM-DD`
 * - month: `month=YYYY-MM`
 * - today / yesterday: no extra params (Asia/Karachi night shift 18:00–07:00)
 * - range: optional `from` / `to` ISO (default last 60 days)
 * Optional `userId` for any period.
 */
export const getAdminCallReportController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const userIdQ = (req.query as { userId?: string }).userId;
    const filterUserId = parseOptionalUserId(userIdQ);

    let range: ReturnType<typeof resolveAdminReportRange>;
    try {
      range = resolveAdminReportRange(req.query as Record<string, unknown>);
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
      message: `Admin call report (${range.period}, ${callReportWindowLabel(range.period)})`,
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

/** Admin: paginated per-user full reports for the same window as the aggregate report. */
export const getAdminCallReportByUserController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    let range: ReturnType<typeof resolveAdminReportRange>;
    try {
      range = resolveAdminReportRange(req.query as Record<string, unknown>);
    } catch (e: any) {
      res.status(400).json({
        success: false,
        message:
          e?.message ||
          "Invalid query. Use period=day|week|month|range with the matching params.",
      });
      return;
    }

    const { page, limit } = req.query as { page?: string; limit?: string };
    const result = await getCallReportByUserPage({
      from: range.from,
      to: range.to,
      page: page != null ? Number(page) : 1,
      limit: limit != null ? Number(limit) : 20,
    });

    res.status(200).json({
      success: true,
      message: `Admin call report by user (${range.period}, ${callReportWindowLabel(range.period)})`,
      data: {
        ...result,
        requestedPeriod: range.period,
      },
    });
  } catch (error: any) {
    const status = error?.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error?.message || "Failed to build call report by user",
    });
  }
};

/** Admin: paginated call rows (optional `userId`); same period params as aggregate report. */
export const getAdminCallReportCallsController = async (
  req: CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    let range: ReturnType<typeof resolveAdminReportRange>;
    try {
      range = resolveAdminReportRange(req.query as Record<string, unknown>);
    } catch (e: any) {
      res.status(400).json({
        success: false,
        message:
          e?.message ||
          "Invalid query. Use period=day|week|month|range with the matching params.",
      });
      return;
    }

    const { page, limit, userId: userIdQ } = req.query as {
      page?: string;
      limit?: string;
      userId?: string;
    };
    const filterUserId = parseOptionalUserId(userIdQ);

    const list = await listReportCalls({
      userId: filterUserId,
      from: range.from,
      to: range.to,
      page: page != null ? Number(page) : 1,
      limit: limit != null ? Number(limit) : 20,
    });

    res.status(200).json({
      success: true,
      message: `Admin call report calls (${range.period}, ${callReportWindowLabel(range.period)})`,
      data: {
        period: { from: range.from.toISOString(), to: range.to.toISOString() },
        requestedPeriod: range.period,
        ...list,
      },
    });
  } catch (error: any) {
    const status = error?.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error?.message || "Failed to list calls",
    });
  }
};
