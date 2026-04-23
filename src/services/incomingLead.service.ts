import { Op, Sequelize } from "sequelize";
import IncomingLead from "../models/incomingLead.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { normalizeLeadDataInput } from "../utils/normalizeLeadData";

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

type BulkIncomingRowInput = {
  campaignName?: string;
  leadData: any;
  externalId?: string;
  dedupeKey?: string;
};

type PreparedIncomingRow = {
  rowNum: number;
  attrs: {
    runId: string;
    payload: any;
    campaignName: string | null;
    externalId: string | null;
    dedupeKey: string | null;
    status: "pending";
  };
};

/**
 * Insert many staging rows in one request (chunked DB writes), same semantics as repeated createIncomingLead.
 */
export const bulkCreateIncomingLeads = async ({
  runId,
  defaultCampaignName,
  rows,
}: {
  runId: string;
  defaultCampaignName?: string;
  rows: BulkIncomingRowInput[];
}) => {
  if (!runId?.trim()) throw new Error("runId is required");
  if (!rows?.length) return { imported: 0, skipped: [] as { row: number; reason: string }[] };

  const trimmedRun = runId.trim();
  const defaultCamp = defaultCampaignName?.trim() || null;

  const prepared: PreparedIncomingRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    try {
      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid leadData");
      }
      const campaignName =
        row.campaignName?.trim() || defaultCamp || null;
      prepared.push({
        rowNum,
        attrs: {
          runId: trimmedRun,
          payload: row.leadData,
          campaignName,
          externalId: row.externalId?.trim() || null,
          dedupeKey: row.dedupeKey?.trim() || null,
          status: "pending",
        },
      });
    } catch (e: any) {
      skipped.push({ row: rowNum, reason: e.message || "Invalid row" });
    }
  }

  let imported = 0;
  const chunkSize = 200;

  for (let i = 0; i < prepared.length; i += chunkSize) {
    const slice = prepared.slice(i, i + chunkSize);
    const chunkAttrs = slice.map((p) => p.attrs);
    try {
      await IncomingLead.bulkCreate(chunkAttrs as any[], { validate: true });
      imported += slice.length;
    } catch {
      for (const p of slice) {
        try {
          await IncomingLead.create(p.attrs as any);
          imported += 1;
        } catch (e: any) {
          skipped.push({
            row: p.rowNum,
            reason: e.message || "Database error",
          });
        }
      }
    }
  }

  return { imported, skipped };
};

export const getIncomingLeads = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "all",
  runId,
  campaignName,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: "pending" | "validated" | "assigned" | "promoted" | "failed" | "all";
  runId?: string;
  /** Exact match on stored campaign name (same string as import) */
  campaignName?: string;
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const andParts: any[] = [];
  if (status !== "all") andParts.push({ status });
  if (runId?.trim()) andParts.push({ runId: runId.trim() });
  if (campaignName?.trim()) andParts.push({ campaignName: campaignName.trim() });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    const orParts: any[] = [
      { externalId: { [Op.like]: term } },
      { runId: { [Op.like]: term } },
    ];
    if (!campaignName?.trim()) {
      orParts.push({ campaignName: { [Op.like]: term } });
    }
    orParts.push(
      Sequelize.where(Sequelize.cast(Sequelize.col("payload"), "CHAR"), {
        [Op.like]: term,
      }),
    );
    andParts.push({ [Op.or]: orParts });
  }

  const whereClause =
    andParts.length === 0
      ? {}
      : andParts.length === 1
        ? andParts[0]
        : { [Op.and]: andParts };

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

const BULK_DELETE_MAX_IDS = 1000;

/** Delete many staging rows in one query. When campaignName is set, only rows for that campaign are removed. */
export const bulkDeleteIncomingLeads = async ({
  ids,
  campaignName,
}: {
  ids: number[];
  campaignName?: string;
}) => {
  const cleanIds = [
    ...new Set(
      ids
        .map((id) => Number(id))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (!cleanIds.length) return { deletedCount: 0 };
  if (cleanIds.length > BULK_DELETE_MAX_IDS) {
    throw new Error(`At most ${BULK_DELETE_MAX_IDS} rows per bulk delete request`);
  }

  const where: any = { id: { [Op.in]: cleanIds } };
  if (campaignName?.trim()) {
    where.campaignName = campaignName.trim();
  }

  const deletedCount = await IncomingLead.destroy({ where });
  return { deletedCount };
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
    leadData: normalizeLeadDataInput(payload),
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

export const resetIncomingLeads = async () => {
  const deleted = await IncomingLead.destroy({
    where: {},
    truncate: true,
    force: true,
  } as any);
  return { deletedCount: deleted };
};
