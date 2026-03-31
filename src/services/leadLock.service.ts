import { Op } from "sequelize";
import Lead from "../models/lead.model";
import LeadLock from "../models/leadLock.model";
import User from "../models/user.model";
import { getPagination, getPagingData } from "../utils/paginate";

export const lockLead = async ({
  leadId,
  lockedByUserId,
  reason,
}: {
  leadId: number;
  lockedByUserId: number;
  reason?: string;
}) => {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const locker = await User.findByPk(lockedByUserId);
  if (!locker) throw new Error("Locking user not found");

  const activeLock = await LeadLock.findOne({ where: { leadId, status: "locked" } });
  if (activeLock) throw new Error("Lead is already locked");

  const lock = await LeadLock.create({
    leadId,
    lockedByUserId,
    reason: reason?.trim() || null,
    status: "locked",
    lockedAt: new Date(),
    unlockedAt: null,
  } as any);

  return lock.toJSON();
};

export const unlockLead = async ({
  leadId,
}: {
  leadId: number;
}) => {
  const activeLock = await LeadLock.findOne({ where: { leadId, status: "locked" } });
  if (!activeLock) throw new Error("Lead is not locked");

  await activeLock.update({
    status: "unlocked",
    unlockedAt: new Date(),
  } as any);

  return activeLock.toJSON();
};

export const getLeadLockByLeadId = async (leadId: number) => {
  const latest = await LeadLock.findOne({
    where: { leadId },
    include: [
      {
        model: User,
        as: "lockedBy",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!latest) {
    return { leadId, isLocked: false, lock: null };
  }

  return { leadId, isLocked: latest.status === "locked", lock: latest.toJSON() };
};

export const getLeadLocks = async ({
  page = 1,
  limit = 20,
  status = "locked",
  search = "",
}: {
  page?: number;
  limit?: number;
  status?: "locked" | "unlocked" | "all";
  search?: string;
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });
  const whereClause: any = {};
  if (status !== "all") whereClause.status = status;

  const userWhere = search
    ? {
        [Op.or]: [
          { firstname: { [Op.like]: `%${search}%` } },
          { lastname: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      }
    : {};

  const data = await LeadLock.findAndCountAll({
    where: whereClause,
    offset,
    limit: pageLimit,
    order: [["updatedAt", "DESC"]],
    include: [
      {
        model: Lead,
        as: "lead",
        attributes: ["id", "campaignName", "leadData"],
        required: false,
      },
      {
        model: User,
        as: "lockedBy",
        where: userWhere,
        required: !!search,
        attributes: ["id", "firstname", "lastname", "email"],
      },
    ],
  });

  return getPagingData(data, page, pageLimit);
};
