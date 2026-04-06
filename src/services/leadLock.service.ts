import { Op } from "sequelize";
import Lead from "../models/lead.model";
import LeadLock from "../models/leadLock.model";
import User from "../models/user.model";
import { getPagination, getPagingData } from "../utils/paginate";

export const lockLead = async ({
  leadId,
  lockedByUserId,
  reason,
  lockDays,
  lockUntil,
}: {
  leadId: number;
  lockedByUserId: number;
  reason?: string;
  lockDays?: number;
  lockUntil?: string | Date;
}) => {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const locker = await User.findByPk(lockedByUserId);
  if (!locker) throw new Error("Locking user not found");

  const now = new Date();
  const activeLock = await LeadLock.findOne({
    where: {
      leadId,
      status: "locked",
      [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: now } }],
    },
  });
  if (activeLock) throw new Error("Lead is already locked");

  let resolvedLockUntil: Date | null = null;
  if (lockDays !== undefined && Number.isFinite(Number(lockDays)) && Number(lockDays) > 0) {
    resolvedLockUntil = new Date(now.getTime() + Number(lockDays) * 24 * 60 * 60 * 1000);
  } else if (lockUntil) {
    const d = new Date(lockUntil);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid lockUntil date");
    resolvedLockUntil = d;
  }

  const lock = await LeadLock.create({
    leadId,
    lockedByUserId,
    reason: reason?.trim() || null,
    status: "locked",
    lockedAt: now,
    lockUntil: resolvedLockUntil,
    unlockedAt: null,
  } as any);

  return lock.toJSON();
};

export const unlockLead = async ({
  leadId,
}: {
  leadId: number;
}) => {
  const now = new Date();
  const activeLock = await LeadLock.findOne({
    where: {
      leadId,
      status: "locked",
      [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: now } }],
    },
  });
  if (!activeLock) throw new Error("Lead is not locked");

  await activeLock.update({
    status: "unlocked",
    unlockedAt: new Date(),
  } as any);

  return activeLock.toJSON();
};

export const getLeadLockByLeadId = async (leadId: number) => {
  const now = new Date();
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

  const isLocked =
    latest.status === "locked" && (!latest.get("lockUntil") || new Date(latest.get("lockUntil") as any) > now);
  return { leadId, isLocked, lock: latest.toJSON() };
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
  const now = new Date();
  if (status === "locked") {
    whereClause.status = "locked";
    whereClause[Op.or] = [{ lockUntil: null }, { lockUntil: { [Op.gt]: now } }];
  } else if (status === "unlocked") {
    whereClause[Op.or] = [
      { status: "unlocked" },
      { status: "locked", lockUntil: { [Op.lte]: now } },
    ];
  }

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
