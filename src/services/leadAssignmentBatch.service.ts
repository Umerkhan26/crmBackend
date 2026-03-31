import LeadAssignmentBatch, {
  BatchStatus,
  BatchTriggerType,
} from "../models/leadAssignmentBatch.model";
import User from "../models/user.model";
import { getPagination, getPagingData } from "../utils/paginate";

export const createLeadAssignmentBatch = async ({
  runId,
  triggerType = "manual",
  triggeredByUserId,
  metadata,
}: {
  runId: string;
  triggerType?: BatchTriggerType;
  triggeredByUserId?: number;
  metadata?: Record<string, any>;
}) => {
  if (!runId?.trim()) throw new Error("runId is required");

  const existing = await LeadAssignmentBatch.findOne({ where: { runId } });
  if (existing) throw new Error("Batch with this runId already exists");

  const batch = await LeadAssignmentBatch.create({
    runId: runId.trim(),
    triggerType,
    triggeredByUserId: triggeredByUserId || null,
    metadata: metadata || null,
    status: "running",
    startedAt: new Date(),
  } as any);

  return batch.toJSON();
};

export const getLeadAssignmentBatches = async ({
  page = 1,
  limit = 20,
  status,
  triggerType,
}: {
  page?: number;
  limit?: number;
  status?: BatchStatus;
  triggerType?: BatchTriggerType;
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });
  const whereClause: any = {};
  if (status) whereClause.status = status;
  if (triggerType) whereClause.triggerType = triggerType;

  const data = await LeadAssignmentBatch.findAndCountAll({
    where: whereClause,
    offset,
    limit: pageLimit,
    order: [["startedAt", "DESC"]],
    include: [
      {
        model: User,
        as: "triggeredBy",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });

  return getPagingData(data, page, pageLimit);
};

export const getLeadAssignmentBatchById = async (id: number) => {
  const batch = await LeadAssignmentBatch.findByPk(id, {
    include: [
      {
        model: User,
        as: "triggeredBy",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });
  if (!batch) throw new Error("Batch not found");
  return batch.toJSON();
};

export const updateLeadAssignmentBatch = async (
  id: number,
  payload: {
    status?: BatchStatus;
    finishedAt?: Date | null;
    rotatedCount?: number;
    rebalancedCount?: number;
    newAssignedCount?: number;
    metadata?: Record<string, any> | null;
    errorMessage?: string | null;
  },
) => {
  const batch = await LeadAssignmentBatch.findByPk(id);
  if (!batch) throw new Error("Batch not found");

  const updateData: any = {};
  if (payload.status) updateData.status = payload.status;
  if (payload.finishedAt !== undefined) updateData.finishedAt = payload.finishedAt;
  if (payload.rotatedCount !== undefined) updateData.rotatedCount = payload.rotatedCount;
  if (payload.rebalancedCount !== undefined) updateData.rebalancedCount = payload.rebalancedCount;
  if (payload.newAssignedCount !== undefined) updateData.newAssignedCount = payload.newAssignedCount;
  if (payload.metadata !== undefined) updateData.metadata = payload.metadata;
  if (payload.errorMessage !== undefined) updateData.errorMessage = payload.errorMessage;

  await batch.update(updateData);
  return batch.toJSON();
};
