import { literal, Op, Sequelize, fn, col, cast } from "sequelize";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import { AssigneeWithStatus } from "../models/lead.model";
import {
  buildLeadCodeFromCampaignAndId,
  normalizeLeadCodeSearchInput,
} from "./leadCode";
import { LEAD_DATA_PHONE_KEYS } from "./normalizeLeadData";

export const LEAD_LIST_MAX_PAGE_SIZE = 100;

export function clampLeadListPagination(page = 1, limit = 10) {
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(
    LEAD_LIST_MAX_PAGE_SIZE,
    Math.max(1, Number(limit) || 10),
  );
  const offset = (pageNum - 1) * pageSize;
  return { pageNum, pageSize, offset };
}

export function parseAssigneesRaw(assignees: unknown): AssigneeWithStatus[] {
  if (Array.isArray(assignees)) return assignees;
  if (typeof assignees === "string") {
    try {
      const parsed = JSON.parse(assignees);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof assignees === "object" && assignees !== null) {
    return [assignees as AssigneeWithStatus];
  }
  return [];
}

/** Push search predicates into SQL (avoids loading entire campaign into memory). */
export function appendLeadSearchToWhere(whereCondition: Record<string, unknown>, search: string) {
  const normalized = normalizeLeadCodeSearchInput(search).trim();
  if (!normalized) return;

  const term = `%${normalized}%`;
  const orParts: unknown[] = [
    Sequelize.where(fn("LOWER", col("campaignName")), {
      [Op.like]: term.toLowerCase(),
    }),
    Sequelize.where(cast(col("leadData"), "CHAR"), { [Op.like]: term }),
  ];

  const leadCodeMatch = normalized.match(/^([a-z]+)-?(\d+)$/i);
  if (leadCodeMatch) {
    const codeNum = Number(leadCodeMatch[2]);
    if (Number.isFinite(codeNum) && codeNum > 0) {
      orParts.push({ id: codeNum });
    }
  } else if (/^\d+$/.test(normalized)) {
    const n = Number(normalized);
    if (Number.isFinite(n) && n > 0) {
      orParts.push({ id: n });
    }
  }

  const existingAnd = whereCondition[Op.and as unknown as string];
  const andArray = Array.isArray(existingAnd)
    ? existingAnd
    : existingAnd != null
      ? [existingAnd]
      : [];
  whereCondition[Op.and as unknown as string] = [...andArray, { [Op.or]: orParts }];
}

/** contactState filter in SQL (aligned with leadRowHasContactPhone). */
export function appendContactStateToWhere(
  whereCondition: Record<string, unknown>,
  contactState: "all" | "present" | "missing",
) {
  if (contactState !== "present" && contactState !== "missing") return;

  const phoneChecks = LEAD_DATA_PHONE_KEYS.map(
    (key) =>
      `(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.${key}')) IS NOT NULL AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.${key}'))) <> '')`,
  ).join(" OR ");

  const expr =
    contactState === "present" ? `(${phoneChecks})` : `NOT (${phoneChecks})`;

  const existingAnd = whereCondition[Op.and as unknown as string];
  const andArray = Array.isArray(existingAnd)
    ? existingAnd
    : existingAnd != null
      ? [existingAnd]
      : [];
  whereCondition[Op.and as unknown as string] = [...andArray, literal(expr)];
}

/** Enrich one page of leads with assignee users (single User query). */
export async function enrichLeadsBatch(leads: Lead[]) {
  const allUserIds = new Set<number>();
  const assigneesByLeadId = new Map<number, AssigneeWithStatus[]>();

  for (const lead of leads) {
    const assigneesRaw = parseAssigneesRaw(lead.assignees);
    assigneesByLeadId.set(lead.id, assigneesRaw);
    for (const a of assigneesRaw) {
      if (typeof a.userId === "number") allUserIds.add(a.userId);
    }
  }

  const users =
    allUserIds.size > 0
      ? await User.findAll({
          where: { id: [...allUserIds] },
          attributes: ["id", "firstname", "lastname", "email"],
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u.toJSON()]));

  return leads.map((lead) => {
    const assigneesRaw = assigneesByLeadId.get(lead.id) || [];
    const assigneesData = assigneesRaw
      .map((assignment) => {
        const user = userMap.get(assignment.userId);
        if (!user) return null;
        return {
          ...user,
          status: assignment.status || "pending",
        };
      })
      .filter(Boolean);

    return {
      ...lead.toJSON(),
      assignees: assigneesData,
      leadCode: buildLeadCodeFromCampaignAndId(
        lead.campaignName || "",
        Number(lead.id),
      ),
    };
  });
}
