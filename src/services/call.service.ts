import { Op } from "sequelize";
import Call, { CallDirection, CallStatus } from "../models/call.model";

export interface StartCallInput {
  phoneNumber: string;
  direction?: CallDirection;
  startedAt?: string; // ISO
  consent?: boolean;
  sttProvider?: string;
  externalCallId?: string;
  leadId?: number;
  clientLeadId?: number;
  metadata?: any;
}

export interface EndCallInput {
  endedAt?: string; // ISO
  status?: Extract<CallStatus, "completed" | "failed">;
  durationSeconds?: number; // Optional: if provided, use this instead of calculating
  metadata?: any;
}

export interface TranscriptInput {
  transcript: string;
  sttProvider?: string;
  metadata?: any;
}

export const startCall = async (userId: number, input: StartCallInput) => {
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
  if (Number.isNaN(startedAt.getTime())) throw new Error("Invalid startedAt");

  const call = await Call.create({
    userId,
    phoneNumber: input.phoneNumber,
    direction: input.direction || "outgoing",
    status: "in_progress",
    startedAt,
    consent: Boolean(input.consent),
    sttProvider: input.sttProvider || null,
    externalCallId: input.externalCallId || null,
    leadId: input.leadId ?? null,
    clientLeadId: input.clientLeadId ?? null,
    metadata: input.metadata ?? null,
  });

  try {
    (global as any).io?.to?.(`user_${userId}`)?.emit?.("call_started", call);
  } catch {
    // ignore socket emit errors
  }

  return call;
};

export const endCall = async (
  userId: number,
  callId: number,
  input: EndCallInput
) => {
  const call = await Call.findOne({ where: { id: callId, userId } });
  if (!call) return null;

  const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
  if (Number.isNaN(endedAt.getTime())) {
    throw new Error("Invalid endedAt");
  }

  const startedAt = call.startedAt ? new Date(call.startedAt) : undefined;

  // Use provided durationSeconds if available (from Google Voice UI), otherwise calculate
  let durationSeconds: number | undefined = input.durationSeconds;

  if (durationSeconds === undefined) {
    durationSeconds =
      startedAt && !Number.isNaN(startedAt.getTime())
        ? Math.max(
            0,
            Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
          )
        : undefined;
  }

  // Debug logs
  if (input.durationSeconds !== undefined) {
    console.log(
      "[Call Service] Using provided duration:",
      input.durationSeconds,
      "seconds (from Google Voice UI)"
    );
  } else {
    console.log(
      "[Call Service] Calculated duration:",
      durationSeconds,
      "seconds (from timestamps)"
    );
  }

  call.endedAt = endedAt;
  call.durationSeconds = durationSeconds;
  call.status = input.status || "completed";

  if (input.metadata) {
    call.metadata = {
      ...(call.metadata || {}),
      ...(input.metadata || {}),
    };
  }

  await call.save();

  try {
    (global as any).io
      ?.to?.(`user_${userId}`)
      ?.emit?.("call_ended", call);
  } catch {
    // ignore socket emit errors
  }

  return call;
};


export const updateTranscript = async (
  userId: number,
  callId: number,
  input: TranscriptInput
) => {
  const call = await Call.findOne({ where: { id: callId, userId } });
  if (!call) return null;

  call.transcript = input.transcript;
  if (input.sttProvider) call.sttProvider = input.sttProvider;
  if (input.metadata) {
    call.metadata = { ...(call.metadata || {}), ...(input.metadata || {}) };
  }

  await call.save();

  try {
    (global as any).io?.to?.(`user_${userId}`)?.emit?.("call_transcript", call);
  } catch {
    // ignore socket emit errors
  }

  return call;
};

/**
 * Fetch a single call. By default scoped to `userId` (owner).
 * When `allowAnyUser` is true (strict admin viewing org reports), any call id may be loaded.
 * When `managedUserIds` is set (brand manager), call may belong to requester or any of those users.
 */
export const getCallById = async (
  userId: number,
  callId: number,
  opts?: { allowAnyUser?: boolean; managedUserIds?: number[] }
) => {
  if (opts?.allowAnyUser) {
    return await Call.findOne({ where: { id: callId } });
  }
  if (opts?.managedUserIds != null) {
    const extra = opts.managedUserIds
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);
    const allowed = [...new Set([userId, ...extra])];
    return await Call.findOne({
      where: { id: callId, userId: { [Op.in]: allowed } },
    });
  }
  return await Call.findOne({ where: { id: callId, userId } });
};

export const listCalls = async (
  userId: number,
  page = 1,
  limit = 20,
  leadId?: number,
  clientLeadId?: number
) => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 && limit <= 100 ? Math.floor(limit) : 20;

  const offset = (safePage - 1) * safeLimit;

  const whereClause: any = { userId };
  if (leadId) {
    whereClause.leadId = leadId;
  }
  if (clientLeadId) {
    whereClause.clientLeadId = clientLeadId;
  }

  const { rows, count } = await Call.findAndCountAll({
    where: whereClause,
    order: [["startedAt", "DESC"]],
    limit: safeLimit,
    offset,
  });

  return {
    rows,
    totalItems: count,
    totalPages: Math.ceil(count / safeLimit),
    currentPage: safePage,
    pageSize: safeLimit,
  };
};

