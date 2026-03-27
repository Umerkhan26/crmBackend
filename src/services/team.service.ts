import { Op } from "sequelize";
import Team, { TeamAttributes, TeamCreationAttributes } from "../models/team.model";
import TeamMember from "../models/teamMember.model";
import User from "../models/user.model";
import Role from "../models/role.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { buildSearchFilter } from "../utils/filterQuery";

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Omit, empty, or "all" → no team status filter. "active" | "inactive" → filter teams by that status. */
  status?: "active" | "inactive";
}

const DEFAULT_TEAMS: Array<Pick<TeamAttributes, "name" | "code" | "sortOrder" | "status">> = [
  { name: "Team A", code: "A", sortOrder: 1, status: "active" },
  { name: "Team B", code: "B", sortOrder: 2, status: "active" },
  { name: "Team C", code: "C", sortOrder: 3, status: "active" },
  { name: "Team D", code: "D", sortOrder: 4, status: "active" },
  { name: "Team E", code: "E", sortOrder: 5, status: "active" },
];

export const seedDefaultTeams = async (): Promise<{ created: number; existing: number }> => {
  const existingTeams = await Team.findAll({
    where: { code: DEFAULT_TEAMS.map((t) => t.code) },
    attributes: ["id", "code"],
  });
  const existingCodes = new Set(existingTeams.map((t) => t.code));
  const toCreate = DEFAULT_TEAMS.filter((t) => !existingCodes.has(t.code));

  if (toCreate.length > 0) {
    await Team.bulkCreate(toCreate as any, { ignoreDuplicates: true });
  }

  return { created: toCreate.length, existing: DEFAULT_TEAMS.length - toCreate.length };
};

export const createTeam = async (data: TeamCreationAttributes): Promise<TeamAttributes> => {
  try {
    const created = await Team.create(data);
    return created.get({ plain: true }) as TeamAttributes;
  } catch (error: any) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("Team with this code already exists");
    }
    throw new Error(`Error creating team: ${error.message}`);
  }
};

/**
 * Lists teams with pagination. Member include still only loads active memberships (for counts).
 * Team-level filter: pass status=active|inactive from API; omit or all → every team status.
 */
export const getAllTeams = async ({
  page = 1,
  limit = 100,
  search = "",
  status,
}: PaginationParams): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });
  const searchWhere = buildSearchFilter(search, ["name", "code"]);
  const whereClause: any = { ...searchWhere };
  if (status === "active" || status === "inactive") {
    whereClause.status = status;
  }

  const data = await Team.findAndCountAll({
    where: whereClause,
    offset,
    limit: pageLimit,
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
    include: [
      {
        model: TeamMember,
        as: "teamMembers",
        required: false,
        where: { status: "active" },
        attributes: ["id", "userId", "status"],
      },
    ],
  });

  const paging = getPagingData(data, page, pageLimit);
  paging.data = (paging.data || []).map((t: any) => {
    const json =
      typeof t?.toJSON === "function" ? t.toJSON() : t?.get?.({ plain: true }) ?? t;
    const teamMembers = json.teamMembers;
    return {
      ...json,
      activeMemberCount: Array.isArray(teamMembers) ? teamMembers.length : 0,
    };
  });

  return paging;
};

export const getTeamById = async (teamId: number): Promise<any> => {
  const team = await Team.findByPk(teamId, {
    include: [
      {
        model: TeamMember,
        as: "teamMembers",
        required: false,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstname", "lastname", "email", "status", "roleId"],
            include: [{ model: Role, as: "role", attributes: ["id", "name"], required: false } as any],
            required: false,
          },
        ],
      },
    ],
  });

  if (!team) throw new Error("Team not found");
  return team.toJSON();
};

export const updateTeam = async (
  teamId: number,
  data: Partial<TeamAttributes>,
): Promise<TeamAttributes> => {
  try {
    const team = await Team.findByPk(teamId);
    if (!team) throw new Error("Team not found");
    await team.update(data);
    return team.get({ plain: true }) as TeamAttributes;
  } catch (error: any) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("Team with this code already exists");
    }
    throw new Error(`Error updating team: ${error.message}`);
  }
};

/** Permanently deletes the team row. Related team_members are removed by DB ON DELETE CASCADE if configured. */
export const deleteTeam = async (teamId: number): Promise<string> => {
  const team = await Team.findByPk(teamId);
  if (!team) throw new Error("Team not found");
  await team.destroy();
  return "Team deleted successfully";
};

export const getTeamMembers = async ({
  teamId,
  page = 1,
  limit = 10,
  search = "",
  status = "active",
}: {
  teamId: number;
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
}): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const whereMember: any = { teamId };
  if (status !== "all") whereMember.status = status;

  // Search against user fields
  const userWhere = search
    ? {
        [Op.or]: [
          { firstname: { [Op.like]: `%${search}%` } },
          { lastname: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      }
    : {};

  const data = await TeamMember.findAndCountAll({
    where: whereMember,
    offset,
    limit: pageLimit,
    order: [["updatedAt", "DESC"]],
    include: [
      {
        model: User,
        as: "user",
        where: userWhere,
        required: !!search,
        attributes: ["id", "firstname", "lastname", "email", "status", "roleId"],
        include: [{ model: Role, as: "role", attributes: ["id", "name"], required: false } as any],
      },
    ],
  });

  const paging = getPagingData(data, page, pageLimit);
  paging.data = (paging.data || []).map((row: any) =>
    typeof row?.toJSON === "function" ? row.toJSON() : row?.get?.({ plain: true }) ?? row,
  );
  return paging;
};

export const addUsersToTeam = async (
  teamId: number,
  userIds: number[],
): Promise<{ added: number; reactivated: number; moved: number; conflicts: number; message: string }> => {
  if (!Array.isArray(userIds)) throw new Error("userIds must be an array");
  if (userIds.length === 0) {
    return { added: 0, reactivated: 0, moved: 0, conflicts: 0, message: "No users to assign" };
  }

  const team = await Team.findByPk(teamId);
  if (!team) throw new Error("Team not found");

  let added = 0;
  let reactivated = 0;
  let moved = 0;
  let conflicts = 0;

  for (const userId of userIds) {
    const existing = await TeamMember.findOne({ where: { userId } });

    if (!existing) {
      await TeamMember.create({ teamId, userId, status: "active", joinedAt: new Date(), leftAt: null } as any);
      added++;
      continue;
    }

    // Same team -> reactivate if needed
    if (existing.teamId === teamId) {
      if (existing.status !== "active") {
        await existing.update({ status: "active", leftAt: null, joinedAt: new Date() } as any);
        reactivated++;
      }
      continue;
    }

    // Different team
    if (existing.status === "active") {
      conflicts++;
      continue;
    }

    // Inactive membership elsewhere -> move to new team and activate
    await existing.update({ teamId, status: "active", leftAt: null, joinedAt: new Date() } as any);
    moved++;
  }

  const messageParts = [
    added ? `${added} added` : null,
    reactivated ? `${reactivated} reactivated` : null,
    moved ? `${moved} moved` : null,
    conflicts ? `${conflicts} conflicts (already active in another team)` : null,
  ].filter(Boolean);

  return {
    added,
    reactivated,
    moved,
    conflicts,
    message: messageParts.length ? messageParts.join(", ") : "No changes",
  };
};

export const setTeamMemberStatus = async (
  teamId: number,
  userId: number,
  status: "active" | "inactive",
): Promise<string> => {
  const member = await TeamMember.findOne({ where: { teamId, userId } });
  if (!member) throw new Error("Team member not found");

  if (status === "active") {
    const otherActive = await TeamMember.findOne({
      where: {
        userId,
        status: "active",
        teamId: { [Op.ne]: teamId },
      },
    });
    if (otherActive) {
      throw new Error("User is already active in another team");
    }
    await member.update({ status: "active", leftAt: null } as any);
    return "Member activated";
  }

  await member.update({ status: "inactive", leftAt: new Date() } as any);
  return "Member deactivated";
};

