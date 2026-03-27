import { Op } from "sequelize";
import Team from "../models/team.model";
import TeamMember from "../models/teamMember.model";
import User from "../models/user.model";
import Role from "../models/role.model";
import { getPagination, getPagingData } from "../utils/paginate";

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

  return getPagingData(data, page, pageLimit);
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

    if (existing.teamId === teamId) {
      if (existing.status !== "active") {
        await existing.update({ status: "active", leftAt: null, joinedAt: new Date() } as any);
        reactivated++;
      }
      continue;
    }

    if (existing.status === "active") {
      conflicts++;
      continue;
    }

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

