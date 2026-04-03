import { Op } from "sequelize";
import IncomingLead from "../models/incomingLead.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";

export const createIncomingLead = async ({
  runId,
  payload,
  campaignName,
  externalId,
  dedupeKey,
}: {
  runId: string;
  payload: any;
  campaignName?: string;
  externalId?: string;
  dedupeKey?: string;
}) => {
  if (!runId?.trim()) throw new Error("runId is required");
  if (!payload) throw new Error("payload is required");
  const rec = await IncomingLead.create({
    runId: runId.trim(),
    payload,
    campaignName: campaignName || null,
    externalId: externalId || null,
    dedupeKey: dedupeKey || null,
    status: "pending",
  } as any);
  return rec.toJSON();
};

export const getIncomingLeads = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "all",
  runId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: "pending" | "validated" | "assigned" | "promoted" | "failed" | "all";
  runId?: string;
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });
  const whereClause: any = {};
  if (status !== "all") whereClause.status = status;
  if (runId) whereClause.runId = runId;
  if (search) {
    whereClause[Op.or] = [
      { campaignName: { [Op.like]: `%${search}%` } },
      { externalId: { [Op.like]: `%${search}%` } },
      { runId: { [Op.like]: `%${search}%` } },
    ];
  }
  const data = await IncomingLead.findAndCountAll({
    where: whereClause,
    offset,
    limit: pageLimit,
    order: [["createdAt", "DESC"]],
  });
  return getPagingData(data, page, pageLimit);
};

export const getIncomingLeadById = async (id: number) => {
  const rec = await IncomingLead.findByPk(id);
  if (!rec) throw new Error("Incoming lead not found");
  return rec.toJSON();
};

export const updateIncomingLead = async (id: number, payload: Partial<any>) => {
  const rec = await IncomingLead.findByPk(id);
  if (!rec) throw new Error("Incoming lead not found");
  await rec.update(payload as any);
  return rec.toJSON();
};

export const deleteIncomingLead = async (id: number) => {
  const rec = await IncomingLead.findByPk(id);
  if (!rec) throw new Error("Incoming lead not found");
  await rec.destroy();
  return "Incoming lead deleted";
};

export const validateIncomingLead = async (id: number, dedupeKey?: string) => {
  const rec = await IncomingLead.findByPk(id);
  if (!rec) throw new Error("Incoming lead not found");
  await rec.update({
    status: "validated",
    dedupeKey: dedupeKey || rec.get("dedupeKey") || null,
    validatedAt: new Date(),
    errorMessage: null,
  } as any);
  return rec.toJSON();
};

export const promoteIncomingLead = async ({
  id,
  createdBy,
}: {
  id: number;
  createdBy?: number;
}) => {
  const rec = await IncomingLead.findByPk(id);
  if (!rec) throw new Error("Incoming lead not found");
  if (rec.get("status") === "promoted") return rec.toJSON();

  const payload: any = rec.get("payload") || {};
  const campaignName: string = (rec.get("campaignName") as any) || payload.campaignName || "General";

  // Create live lead (no assignment here; cron will handle later)
  const lead = await Lead.create({
    campaignName,
    leadData: payload,
    createdBy: createdBy || null,
    assignees: [],
  } as any);

  await rec.update({
    status: "promoted",
    promotedAt: new Date(),
    targetLeadId: (lead as any).id,
  } as any);

  return { ...(rec.toJSON() as any), targetLead: lead.toJSON() };
};

export const bulkPromoteIncomingLeads = async ({
  runId,
  ids,
  createdBy,
}: {
  runId?: string;
  ids?: number[];
  createdBy?: number;
}) => {
  const where: any = { status: { [Op.ne]: "promoted" } };
  if (runId) where.runId = runId;
  if (ids && ids.length > 0) where.id = { [Op.in]: ids };

  const rows = await IncomingLead.findAll({ where, order: [["id", "ASC"]] });
  const results: any[] = [];
  for (const rec of rows) {
    try {
      const res = await promoteIncomingLead({ id: rec.get("id") as any, createdBy });
      results.push({ id: rec.get("id"), success: true, targetLeadId: (res as any)?.targetLead?.id });
    } catch (e: any) {
      results.push({ id: rec.get("id"), success: false, error: e.message });
    }
  }
  return { count: rows.length, results };
};
