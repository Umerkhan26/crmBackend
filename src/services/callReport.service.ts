import db from "../../db";
import { Op, QueryTypes } from "sequelize";
import { DateTime } from "luxon";
import Call from "../models/call.model";
import User from "../models/user.model";
import Lead from "../models/lead.model";
import { buildLeadCodeFromCampaignAndId } from "../utils/leadCode";

export interface CallReportPeriod {
  from: string;
  to: string;
}

export interface CallReportOptions {
  /** Single user (self, admin filter, or one team member). */
  userId?: number | null;
  /** Multiple users (e.g. brand team aggregate). When set, overrides `userId`. */
  userIds?: number[] | null;
  from: Date;
  to: Date;
}

export interface DurationBucketRow {
  key: string;
  label: string;
  minSec: number | null;
  maxSec: number | null;
  count: number;
  percentOfTotal: number;
}

export interface CumulativeRow {
  key: string;
  label: string;
  thresholdSeconds: number | null;
  count: number;
}

export interface DialFrequencyRow {
  key: string;
  label: string;
  numberCount: number;
}

export interface CallReportSummary {
  period: CallReportPeriod;
  scope: {
    direction: "outgoing";
    statuses: ("completed" | "failed")[];
    timeField: "startedAt";
  };
  summary: {
    uniqueNumbersDialed: number;
    totalCalls: number;
    totalDurationSeconds: number;
    totalDurationFormatted: string;
    avgCallDurationSeconds: number | null;
    activeDays: number;
    repeatDialedNumbers: number;
  };
  durationBuckets: DurationBucketRow[];
  durationCumulative: CumulativeRow[];
  dialFrequencyByNumber: DialFrequencyRow[];
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

/** Identifier quote for raw SQL (MySQL vs PostgreSQL). */
function q(name: string): string {
  return db.getDialect() === "postgres" ? `"${name}"` : `\`${name}\``;
}

function dateDistinctSql(): string {
  const dialect = db.getDialect();
  if (dialect === "postgres") {
    return `CAST(${q("startedAt")} AS DATE)`;
  }
  return `DATE(${q("startedAt")})`;
}

function buildWhereReplacements(
  from: Date,
  to: Date,
  userId: number | null | undefined,
  userIds?: number[] | null,
): { sql: string; replacements: Record<string, unknown> } {
  const replacements: Record<string, unknown> = { from, to };
  let userClause = "";

  if (userIds != null) {
    if (userIds.length === 0) {
      userClause = "AND 1=0";
    } else {
      const ids = [
        ...new Set(
          userIds
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ];
      if (ids.length === 0) {
        userClause = "AND 1=0";
      } else {
        const ph = ids.map((_, i) => `:rpuid${i}`);
        ids.forEach((id, i) => {
          replacements[`rpuid${i}`] = id;
        });
        userClause = `AND ${q("userId")} IN (${ph.join(", ")})`;
      }
    }
  } else if (userId != null && Number.isFinite(userId)) {
    userClause = `AND ${q("userId")} = :userId`;
    replacements.userId = userId;
  }

  return {
    sql: `
      ${q("status")} IN ('completed', 'failed')
      AND ${q("direction")} = 'outgoing'
      AND ${q("startedAt")} >= :from
      AND ${q("startedAt")} <= :to
      ${userClause}
    `,
    replacements,
  };
}

/**
 * Lightweight COUNT for dashboard widgets (same filters as {@link getCallReportSummary}).
 * Omit scope for org-wide; pass userId for one user; pass userIds for IN (...).
 */
export async function countOutboundCallsInRange(
  from: Date,
  to: Date,
  scope?: { userId?: number | null; userIds?: number[] },
): Promise<number> {
  const repl: Record<string, unknown> = { from, to };
  let userClause = "";
  if (scope?.userIds && scope.userIds.length > 0) {
    const ids = [
      ...new Set(
        scope.userIds
          .map((id) => Number(id))
          .filter((n) => Number.isFinite(n)),
      ),
    ];
    if (ids.length === 0) return 0;
    const placeholders = ids.map((_, i) => `:u${i}`);
    ids.forEach((id, i) => {
      repl[`u${i}`] = id;
    });
    userClause = `AND ${q("userId")} IN (${placeholders.join(", ")})`;
  } else if (scope?.userId != null && Number.isFinite(Number(scope.userId))) {
    userClause = `AND ${q("userId")} = :userId`;
    repl.userId = Number(scope.userId);
  }

  const sql = `
    SELECT COUNT(*) AS totalCalls
    FROM ${q("calls")}
    WHERE ${q("status")} IN ('completed', 'failed')
      AND ${q("direction")} = 'outgoing'
      AND ${q("startedAt")} >= :from
      AND ${q("startedAt")} <= :to
      ${userClause}
  `;
  const [row] = (await db.query(sql, {
    replacements: repl,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];
  return Number(row?.totalCalls ?? 0);
}

export async function getCallReportSummary(
  opts: CallReportOptions
): Promise<CallReportSummary> {
  const { from, to } = opts;
  const useUserIds = opts.userIds != null;
  const userIds = useUserIds ? opts.userIds : null;
  const userId =
    !useUserIds && opts.userId != null && Number.isFinite(opts.userId)
      ? Number(opts.userId)
      : null;

  const { sql: whereSql, replacements } = buildWhereReplacements(
    from,
    to,
    userId,
    userIds,
  );

  const ds = q("durationSeconds");
  const aggSql = `
    SELECT
      COUNT(*) AS totalCalls,
      SUM(COALESCE(${ds}, 0)) AS totalDurationSeconds,
      AVG(${ds}) AS avgDurationSeconds,
      SUM(CASE WHEN COALESCE(${ds}, 0) = 0 THEN 1 ELSE 0 END) AS b_no_answer,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 0 AND COALESCE(${ds}, 0) <= 30 THEN 1 ELSE 0 END) AS b_1_30,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 30 AND COALESCE(${ds}, 0) <= 60 THEN 1 ELSE 0 END) AS b_31_60,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 60 AND COALESCE(${ds}, 0) <= 120 THEN 1 ELSE 0 END) AS b_61_120,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 120 AND COALESCE(${ds}, 0) <= 180 THEN 1 ELSE 0 END) AS b_121_180,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 180 AND COALESCE(${ds}, 0) <= 300 THEN 1 ELSE 0 END) AS b_181_300,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 300 AND COALESCE(${ds}, 0) <= 600 THEN 1 ELSE 0 END) AS b_301_600,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 600 THEN 1 ELSE 0 END) AS b_600_plus,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 0 THEN 1 ELSE 0 END) AS c_gt_0,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 30 THEN 1 ELSE 0 END) AS c_gt_30,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 60 THEN 1 ELSE 0 END) AS c_gt_60,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 120 THEN 1 ELSE 0 END) AS c_gt_120,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 180 THEN 1 ELSE 0 END) AS c_gt_180,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 300 THEN 1 ELSE 0 END) AS c_gt_300,
      SUM(CASE WHEN COALESCE(${ds}, 0) > 600 THEN 1 ELSE 0 END) AS c_gt_600
    FROM ${q("calls")}
    WHERE ${whereSql}
  `;

  const [aggRow] = (await db.query(aggSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];

  const totalCalls = Number(aggRow?.totalCalls ?? 0);
  const totalDurationSeconds = Number(aggRow?.totalDurationSeconds ?? 0);
  const avgRaw = aggRow?.avgDurationSeconds;
  const avgCallDurationSeconds =
    avgRaw === null || avgRaw === undefined
      ? null
      : Math.round(Number(avgRaw) * 100) / 100;

  const distinctSql = `
    SELECT COUNT(DISTINCT ${q("phoneNumber")}) AS cnt
    FROM ${q("calls")}
    WHERE ${whereSql}
  `;
  const [distinctRow] = (await db.query(distinctSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];
  const uniqueNumbersDialed = Number(distinctRow?.cnt ?? 0);

  const repeatSql = `
    SELECT COUNT(*) AS cnt FROM (
      SELECT ${q("phoneNumber")}
      FROM ${q("calls")}
      WHERE ${whereSql}
      GROUP BY ${q("phoneNumber")}
      HAVING COUNT(*) > 1
    ) t
  `;
  const [repeatRow] = (await db.query(repeatSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];
  const repeatDialedNumbers = Number(repeatRow?.cnt ?? 0);

  const dd = dateDistinctSql();
  const activeDaysSql = `
    SELECT COUNT(DISTINCT ${dd}) AS cnt
    FROM ${q("calls")}
    WHERE ${whereSql}
  `;
  const [activeRow] = (await db.query(activeDaysSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];
  const activeDays = Number(activeRow?.cnt ?? 0);

  const freqSql = `
    SELECT bucket, COUNT(*) AS numberCount FROM (
      SELECT
        ${q("phoneNumber")},
        CASE
          WHEN COUNT(*) = 1 THEN 'exactly_once'
          WHEN COUNT(*) BETWEEN 2 AND 3 THEN '2_3'
          WHEN COUNT(*) BETWEEN 4 AND 5 THEN '4_5'
          WHEN COUNT(*) BETWEEN 6 AND 10 THEN '6_10'
          WHEN COUNT(*) BETWEEN 11 AND 20 THEN '11_20'
          WHEN COUNT(*) BETWEEN 21 AND 30 THEN '21_30'
          ELSE '31_plus'
        END AS bucket
      FROM ${q("calls")}
      WHERE ${whereSql}
      GROUP BY ${q("phoneNumber")}
    ) x
    GROUP BY bucket
  `;
  const freqRows = (await db.query(freqSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];

  const pct = (n: number) =>
    totalCalls > 0 ? Math.round((n / totalCalls) * 1000) / 10 : 0;

  const b = (key: string, label: string, minSec: number | null, maxSec: number | null, count: number): DurationBucketRow => ({
    key,
    label,
    minSec,
    maxSec,
    count,
    percentOfTotal: pct(count),
  });

  const durationBuckets: DurationBucketRow[] = [
    b("no_answer", "No Answer (0 sec)", 0, 0, Number(aggRow?.b_no_answer ?? 0)),
    b("1_30", "1–30 sec", 1, 30, Number(aggRow?.b_1_30 ?? 0)),
    b("31_60", "31–60 sec", 31, 60, Number(aggRow?.b_31_60 ?? 0)),
    b("61_120", "1–2 min", 61, 120, Number(aggRow?.b_61_120 ?? 0)),
    b("121_180", "2–3 min", 121, 180, Number(aggRow?.b_121_180 ?? 0)),
    b("181_300", "3–5 min", 181, 300, Number(aggRow?.b_181_300 ?? 0)),
    b("301_600", "5–10 min", 301, 600, Number(aggRow?.b_301_600 ?? 0)),
    b("600_plus", "10+ min", 601, null, Number(aggRow?.b_600_plus ?? 0)),
  ];

  const durationCumulative: CumulativeRow[] = [
    {
      key: "gt_0",
      label: "Calls > 0 sec (connected)",
      thresholdSeconds: 0,
      count: Number(aggRow?.c_gt_0 ?? 0),
    },
    {
      key: "gt_30",
      label: "Calls > 30 sec",
      thresholdSeconds: 30,
      count: Number(aggRow?.c_gt_30 ?? 0),
    },
    {
      key: "gt_60",
      label: "Calls > 1 min",
      thresholdSeconds: 60,
      count: Number(aggRow?.c_gt_60 ?? 0),
    },
    {
      key: "gt_120",
      label: "Calls > 2 min",
      thresholdSeconds: 120,
      count: Number(aggRow?.c_gt_120 ?? 0),
    },
    {
      key: "gt_180",
      label: "Calls > 3 min",
      thresholdSeconds: 180,
      count: Number(aggRow?.c_gt_180 ?? 0),
    },
    {
      key: "gt_300",
      label: "Calls > 5 min",
      thresholdSeconds: 300,
      count: Number(aggRow?.c_gt_300 ?? 0),
    },
    {
      key: "gt_600",
      label: "Calls > 10 min",
      thresholdSeconds: 600,
      count: Number(aggRow?.c_gt_600 ?? 0),
    },
    {
      key: "no_answer",
      label: "No Answer (0 sec)",
      thresholdSeconds: null,
      count: Number(aggRow?.b_no_answer ?? 0),
    },
  ];

  const freqLabels: Record<string, string> = {
    exactly_once: "Dialed exactly once",
    "2_3": "Dialed 2–3 times",
    "4_5": "Dialed 4–5 times",
    "6_10": "Dialed 6–10 times",
    "11_20": "Dialed 11–20 times",
    "21_30": "Dialed 21–30 times",
    "31_plus": "Dialed 31+ times",
  };

  const dialFrequencyByNumber: DialFrequencyRow[] = Object.keys(freqLabels).map(
    (key) => {
      const row = freqRows.find((r) => String(r.bucket) === key);
      return {
        key,
        label: freqLabels[key],
        numberCount: Number(row?.numberCount ?? 0),
      };
    }
  );

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    scope: {
      direction: "outgoing",
      statuses: ["completed", "failed"],
      timeField: "startedAt",
    },
    summary: {
      uniqueNumbersDialed,
      totalCalls,
      totalDurationSeconds,
      totalDurationFormatted: formatDuration(totalDurationSeconds),
      avgCallDurationSeconds,
      activeDays,
      repeatDialedNumbers,
    },
    durationBuckets,
    durationCumulative,
    dialFrequencyByNumber,
  };
}

export function parseIsoDateRange(
  fromStr?: string,
  toStr?: string,
  defaultDays = 60
): { from: Date; to: Date } {
  const now = new Date();
  let to = toStr ? new Date(toStr) : now;
  if (Number.isNaN(to.getTime())) {
    to = now;
  }
  let from = fromStr ? new Date(fromStr) : new Date(to);
  if (fromStr && Number.isNaN(from.getTime())) {
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - defaultDays);
  }
  if (!fromStr) {
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - defaultDays);
  }
  if (from.getTime() > to.getTime()) {
    const t = from;
    from = to;
    to = t;
  }
  return { from, to };
}

export function dayRangeUtc(dateStr: string): { from: Date; to: Date } {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date parameter");
  }
  const from = new Date(d);
  const to = new Date(d);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

/** Reporting "day" for night operations: 18:00 PKT through next calendar day 07:00 PKT (inclusive end). */
const REPORT_NIGHT_SHIFT_ZONE = "Asia/Karachi";
const NIGHT_SHIFT_START_HOUR = 18;
const NIGHT_SHIFT_END_HOUR = 7;

function nightShiftStartForNowPkt(nowPkt: DateTime): DateTime {
  const h = nowPkt.hour;
  if (h >= NIGHT_SHIFT_START_HOUR) {
    return nowPkt.startOf("day").set({
      hour: NIGHT_SHIFT_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }
  if (h < NIGHT_SHIFT_END_HOUR) {
    return nowPkt
      .minus({ days: 1 })
      .startOf("day")
      .set({
        hour: NIGHT_SHIFT_START_HOUR,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
  }
  return nowPkt
    .minus({ days: 1 })
    .startOf("day")
    .set({
      hour: NIGHT_SHIFT_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
}

function boundsFromNightShiftStart(startPkt: DateTime): { from: Date; to: Date } {
  const endPkt = startPkt
    .plus({ days: 1 })
    .set({
      hour: NIGHT_SHIFT_END_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    .minus({ milliseconds: 1 });
  return {
    from: startPkt.toUTC().toJSDate(),
    to: endPkt.toUTC().toJSDate(),
  };
}

/** Current operational "today" (PKT night window). Between 07:00–18:00 PKT, this is the shift that ended at 07:00 this morning. */
export function todayNightShiftKarachiRange(now = new Date()): {
  from: Date;
  to: Date;
} {
  const nowPkt = DateTime.fromJSDate(now, { zone: REPORT_NIGHT_SHIFT_ZONE });
  return boundsFromNightShiftStart(nightShiftStartForNowPkt(nowPkt));
}

/** Previous PKT night window before {@link todayNightShiftKarachiRange}. */
export function yesterdayNightShiftKarachiRange(now = new Date()): {
  from: Date;
  to: Date;
} {
  const nowPkt = DateTime.fromJSDate(now, { zone: REPORT_NIGHT_SHIFT_ZONE });
  const todayStart = nightShiftStartForNowPkt(nowPkt);
  return boundsFromNightShiftStart(todayStart.minus({ days: 1 }));
}

export function weekRangeUtc(weekStartStr: string): { from: Date; to: Date } {
  const from = new Date(`${weekStartStr}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) {
    throw new Error("Invalid weekStart parameter");
  }
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 6);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

export function monthRangeUtc(monthStr: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr.trim());
  if (!m) {
    throw new Error("Invalid month parameter (use YYYY-MM)");
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    throw new Error("Invalid month parameter");
  }
  const from = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { from, to };
}

export type AdminReportPeriod =
  | "day"
  | "week"
  | "month"
  | "range"
  | "today"
  | "yesterday";

/** User report: optional `period=today|yesterday` overrides `from`/`to`; otherwise same as parseIsoDateRange. */
export function resolveUserReportRange(query: {
  period?: string;
  from?: string;
  to?: string;
}): { from: Date; to: Date; requestedPeriod: "today" | "yesterday" | "range" } {
  const raw = query.period?.toLowerCase().trim() || "";
  if (raw === "today") {
    const { from, to } = todayNightShiftKarachiRange();
    return { from, to, requestedPeriod: "today" };
  }
  if (raw === "yesterday") {
    const { from, to } = yesterdayNightShiftKarachiRange();
    return { from, to, requestedPeriod: "yesterday" };
  }
  const { from, to } = parseIsoDateRange(query.from, query.to, 60);
  return { from, to, requestedPeriod: "range" };
}

/** Shared admin date-window resolver (query matches call report controller). */
export function resolveAdminReportRange(query: Record<string, unknown>): {
  from: Date;
  to: Date;
  period: AdminReportPeriod;
} {
  const raw = (query.period as string)?.toLowerCase().trim();
  if (
    raw &&
    !["day", "week", "month", "range", "today", "yesterday"].includes(raw)
  ) {
    throw new Error(
      `Unknown period "${query.period}". Use day, week, month, range, today, yesterday (or omit for range).`
    );
  }

  if (raw === "today") {
    const { from, to } = todayNightShiftKarachiRange();
    return { from, to, period: "today" };
  }
  if (raw === "yesterday") {
    const { from, to } = yesterdayNightShiftKarachiRange();
    return { from, to, period: "yesterday" };
  }

  const period: AdminReportPeriod =
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

export interface CallReportPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function safePageLimit(page: unknown, limit: unknown): { page: number; limit: number } {
  const p = Number(page);
  const l = Number(limit);
  const safePage = Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
  const safeLimit = Number.isFinite(l) && l > 0 ? Math.min(100, Math.floor(l)) : 20;
  return { page: safePage, limit: safeLimit };
}

/** Paginated outbound report-scoped calls (same filters as the summary). */
export async function listReportCalls(opts: {
  userId?: number | null;
  userIds?: number[] | null;
  from: Date;
  to: Date;
  page: number;
  limit: number;
}): Promise<{
  rows: Array<
    Record<string, unknown> & {
      leadDisplayCode: string | null;
      user: {
        id: number;
        firstname: string | null;
        lastname: string | null;
        email: string | null;
      } | null;
    }
  >;
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}> {
  const { page, limit } = safePageLimit(opts.page, opts.limit);
  const offset = (page - 1) * limit;

  if (opts.userIds != null && opts.userIds.length === 0) {
    return {
      rows: [],
      totalItems: 0,
      totalPages: 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  const where: Record<string, unknown> = {
    status: { [Op.in]: ["completed", "failed"] },
    direction: "outgoing",
    startedAt: { [Op.between]: [opts.from, opts.to] },
  };
  if (opts.userIds != null && opts.userIds.length > 0) {
    const ids = [
      ...new Set(
        opts.userIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ];
    if (ids.length === 0) {
      return {
        rows: [],
        totalItems: 0,
        totalPages: 1,
        currentPage: page,
        pageSize: limit,
      };
    }
    where.userId = { [Op.in]: ids };
  } else if (opts.userId != null && Number.isFinite(opts.userId)) {
    where.userId = Number(opts.userId);
  }

  const { rows, count } = await Call.findAndCountAll({
    where: where as any,
    order: [["startedAt", "DESC"]],
    limit,
    offset,
    attributes: [
      "id",
      "userId",
      "phoneNumber",
      "direction",
      "status",
      "startedAt",
      "endedAt",
      "durationSeconds",
      "leadId",
      "clientLeadId",
    ],
  });

  const distinctUserIds = [
    ...new Set(
      rows
        .map((r) => r.userId)
        .filter((id) => id != null && Number.isFinite(Number(id)))
        .map((id) => Number(id)),
    ),
  ];
  const users =
    distinctUserIds.length > 0
      ? await User.findAll({
          where: { id: distinctUserIds },
          attributes: ["id", "firstname", "lastname", "email"],
        })
      : [];
  const userById = new Map(users.map((u) => [u.id as number, u]));

  const leadIds = [
    ...new Set(
      rows
        .map((r) => r.leadId)
        .filter((id) => id != null && Number.isFinite(Number(id)))
        .map((id) => Number(id)),
    ),
  ];
  const leads =
    leadIds.length > 0
      ? await Lead.findAll({
          where: { id: leadIds },
          attributes: ["id", "campaignName"],
        })
      : [];
  const leadById = new Map(leads.map((l) => [l.id as number, l]));

  const enrichedRows = rows.map((row) => {
    const plain = row.get({ plain: true }) as unknown as Record<string, unknown>;
    const u = userById.get(Number(row.userId));
    const lead = row.leadId != null ? leadById.get(Number(row.leadId)) : undefined;
    const canonical =
      lead != null
        ? buildLeadCodeFromCampaignAndId(
            String(lead.campaignName || ""),
            Number(lead.id),
          )
        : null;
    const leadDisplayCode =
      canonical && canonical.length > 0 ? canonical : null;

    return {
      ...plain,
      leadDisplayCode,
      user:
        u && u.id != null
          ? {
              id: u.id as number,
              firstname: u.firstname ?? null,
              lastname: u.lastname ?? null,
              email: u.email ?? null,
            }
          : null,
    };
  });

  return {
    rows: enrichedRows,
    totalItems: count,
    totalPages: Math.ceil(count / limit) || 0,
    currentPage: page,
    pageSize: limit,
  };
}

export interface CallReportByUserRow {
  userId: number;
  user: {
    id: number;
    firstname: string | null;
    lastname: string | null;
    email: string | null;
  } | null;
  report: CallReportSummary;
}

/** Admin: one full report per user, paginated by distinct users who had report-scoped calls. */
export async function getCallReportByUserPage(opts: {
  from: Date;
  to: Date;
  page: number;
  limit: number;
}): Promise<{
  period: CallReportPeriod;
  pagination: CallReportPaginationMeta;
  items: CallReportByUserRow[];
}> {
  const { page, limit } = safePageLimit(opts.page, opts.limit);
  const offset = (page - 1) * limit;

  const { sql: whereSql, replacements } = buildWhereReplacements(
    opts.from,
    opts.to,
    null,
    null,
  );

  const countSql = `
    SELECT COUNT(*) AS c FROM (
      SELECT DISTINCT ${q("userId")} FROM ${q("calls")} WHERE ${whereSql}
    ) x
  `;
  const [countRow] = (await db.query(countSql, {
    replacements,
    type: QueryTypes.SELECT,
  })) as Record<string, unknown>[];
  const totalItems = Number(countRow?.c ?? 0);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

  const idsSql = `
    SELECT DISTINCT ${q("userId")} AS userId
    FROM ${q("calls")}
    WHERE ${whereSql}
    ORDER BY ${q("userId")} ASC
    LIMIT :limit OFFSET :offset
  `;
  const idRows = (await db.query(idsSql, {
    replacements: { ...replacements, limit, offset },
    type: QueryTypes.SELECT,
  })) as { userId: number }[];

  const userIds = idRows.map((r) => Number(r.userId)).filter((id) => Number.isFinite(id));

  const users =
    userIds.length > 0
      ? await User.findAll({
          where: { id: userIds },
          attributes: ["id", "firstname", "lastname", "email"],
        })
      : [];

  const userById = new Map(users.map((u) => [u.id, u]));

  const reports = await Promise.all(
    userIds.map((uid) =>
      getCallReportSummary({ userId: uid, from: opts.from, to: opts.to })
    )
  );

  const items: CallReportByUserRow[] = userIds.map((uid, i) => {
    const u = userById.get(uid);
    return {
      userId: uid,
      user: u && u.id != null
        ? {
            id: u.id as number,
            firstname: u.firstname ?? null,
            lastname: u.lastname ?? null,
            email: u.email ?? null,
          }
        : null,
      report: reports[i],
    };
  });

  return {
    period: {
      from: opts.from.toISOString(),
      to: opts.to.toISOString(),
    },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
    items,
  };
}
