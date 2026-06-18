import { Op } from "sequelize";
import "../models/associations";
import FollowUpSequence from "../models/followUpSequence.model";
import FollowUpStep from "../models/followUpStep.model";
import FollowUpStepTiming, {
  FollowUpDelayUnit,
} from "../models/followUpStepTiming.model";
import FollowUpEnrollment from "../models/followUpEnrollment.model";
import FollowUpScheduledEmail from "../models/followUpScheduledEmail.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import Brand from "../models/brand.model";

export const addDelay = (
  base: Date,
  amount: number,
  unit: FollowUpDelayUnit
): Date => {
  const ms = unit === "hours" ? amount * 3_600_000 : amount * 86_400_000;
  return new Date(base.getTime() + ms);
};

const getActiveSequence = async () => {
  return FollowUpSequence.findOne({
    where: { trigger: "customer_provisioned", isActive: true },
    order: [["id", "ASC"]],
  });
};

/** Admin UI: load the program even when paused (isActive=false). */
const getDefaultSequence = async () => {
  return FollowUpSequence.findOne({
    where: { trigger: "customer_provisioned" },
    order: [["id", "ASC"]],
  });
};

export const listFollowUpSequences = async () => {
  const sequences = await FollowUpSequence.findAll({
    order: [["id", "ASC"]],
    attributes: ["id", "name", "trigger", "isActive", "createdAt", "updatedAt"],
  });
  return sequences;
};

export const updateFollowUpSequence = async (
  sequenceId: number,
  data: { name?: string; isActive?: boolean }
) => {
  const sequence = await FollowUpSequence.findByPk(sequenceId);
  if (!sequence) throw new Error("Follow-up sequence not found");

  await sequence.update({
    ...(data.name != null ? { name: data.name.trim() } : {}),
    ...(data.isActive != null ? { isActive: data.isActive } : {}),
  });

  return sequence;
};

export const listFollowUpStepsContent = async (sequenceId?: number) => {
  const sequence =
    sequenceId != null
      ? await FollowUpSequence.findByPk(sequenceId)
      : await getDefaultSequence();

  if (!sequence) return { sequence: null, steps: [] };

  const steps = await FollowUpStep.findAll({
    where: { sequenceId: sequence.id },
    order: [["sortOrder", "ASC"], ["id", "ASC"]],
    attributes: [
      "id",
      "sequenceId",
      "name",
      "sortOrder",
      "subject",
      "body",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
  });

  return { sequence, steps };
};

export const createFollowUpStepContent = async (data: {
  sequenceId: number;
  name: string;
  subject: string;
  body: string;
  sortOrder?: number;
  isActive?: boolean;
}) => {
  const sequence = await FollowUpSequence.findByPk(data.sequenceId);
  if (!sequence) throw new Error("Follow-up sequence not found");

  const maxOrder = (await FollowUpStep.max("sortOrder", {
    where: { sequenceId: data.sequenceId },
  })) as number | null;

  const step = await FollowUpStep.create({
    sequenceId: data.sequenceId,
    name: data.name.trim(),
    subject: data.subject.trim(),
    body: data.body.trim(),
    sortOrder: data.sortOrder ?? (maxOrder != null ? maxOrder + 1 : 1),
    isActive: data.isActive ?? true,
  });

  await FollowUpStepTiming.create({
    stepId: step.id,
    delayAmount: 3,
    delayUnit: "days",
    isActive: true,
  });

  const activeEnrollments = await FollowUpEnrollment.findAll({
    where: { sequenceId: data.sequenceId, status: "active" },
  });
  for (const enrollment of activeEnrollments) {
    await scheduleEmailsForEnrollment(enrollment);
  }

  return step;
};

export const updateFollowUpStepContent = async (
  stepId: number,
  data: {
    name?: string;
    subject?: string;
    body?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
) => {
  const step = await FollowUpStep.findByPk(stepId);
  if (!step) throw new Error("Follow-up step not found");

  await step.update({
    ...(data.name != null ? { name: data.name.trim() } : {}),
    ...(data.subject != null ? { subject: data.subject.trim() } : {}),
    ...(data.body != null ? { body: data.body.trim() } : {}),
    ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
    ...(data.isActive != null ? { isActive: data.isActive } : {}),
  });

  if (data.isActive === false) {
    await FollowUpScheduledEmail.update(
      { status: "cancelled" },
      { where: { stepId, status: "pending" } }
    );
  }

  return step.reload();
};

export const deleteFollowUpStep = async (stepId: number) => {
  const step = await FollowUpStep.findByPk(stepId);
  if (!step) throw new Error("Follow-up step not found");

  await FollowUpScheduledEmail.update(
    { status: "cancelled" },
    { where: { stepId, status: { [Op.in]: ["pending", "processing"] } } }
  );

  await step.destroy();
  return { deleted: true };
};

export const listFollowUpStepTimings = async (sequenceId?: number) => {
  const sequence =
    sequenceId != null
      ? await FollowUpSequence.findByPk(sequenceId)
      : await getDefaultSequence();

  if (!sequence) return { sequence: null, timings: [] };

  const steps = await FollowUpStep.findAll({
    where: { sequenceId: sequence.id },
    order: [["sortOrder", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: FollowUpStepTiming,
        as: "timing",
        required: false,
      },
    ],
  });

  const timings = steps.map((step) => {
    const plain = step.toJSON() as any;
    return {
      stepId: step.id,
      stepName: step.name,
      sortOrder: step.sortOrder,
      stepIsActive: step.isActive,
      timing: plain.timing || null,
    };
  });

  return { sequence, timings };
};

export const updateFollowUpStepTiming = async (
  stepId: number,
  data: {
    delayAmount: number;
    delayUnit?: FollowUpDelayUnit;
    isActive?: boolean;
  }
) => {
  const step = await FollowUpStep.findByPk(stepId);
  if (!step) throw new Error("Follow-up step not found");

  if (!Number.isFinite(data.delayAmount) || data.delayAmount < 0) {
    throw new Error("Delay amount must be zero or greater");
  }

  let timing = await FollowUpStepTiming.findOne({ where: { stepId } });
  if (!timing) {
    timing = await FollowUpStepTiming.create({
      stepId,
      delayAmount: data.delayAmount,
      delayUnit: data.delayUnit || "days",
      isActive: data.isActive ?? true,
    });
  } else {
    await timing.update({
      delayAmount: data.delayAmount,
      ...(data.delayUnit ? { delayUnit: data.delayUnit } : {}),
      ...(data.isActive != null ? { isActive: data.isActive } : {}),
    });
  }

  await recalculatePendingSchedulesForStep(stepId);

  if (data.isActive === false) {
    await FollowUpScheduledEmail.update(
      { status: "cancelled" },
      { where: { stepId, status: "pending" } }
    );
  }

  return timing.reload();
};

export const recalculatePendingSchedulesForStep = async (stepId: number) => {
  const timing = await FollowUpStepTiming.findOne({
    where: { stepId, isActive: true },
  });
  if (!timing) return;

  const pending = await FollowUpScheduledEmail.findAll({
    where: { stepId, status: "pending" },
    include: [
      {
        model: FollowUpEnrollment,
        as: "enrollment",
        where: { status: "active" },
        required: true,
      },
    ],
  });

  for (const scheduled of pending) {
    const enrollment = (scheduled as any).enrollment as FollowUpEnrollment;
    await scheduled.update({
      scheduledAt: addDelay(
        enrollment.enrolledAt,
        timing.delayAmount,
        timing.delayUnit
      ),
    });
  }
};

const scheduleEmailsForEnrollment = async (enrollment: FollowUpEnrollment) => {
  const steps = await FollowUpStep.findAll({
    where: { sequenceId: enrollment.sequenceId, isActive: true },
    order: [["sortOrder", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: FollowUpStepTiming,
        as: "timing",
        where: { isActive: true },
        required: true,
      },
    ],
  });

  for (const step of steps) {
    const timing = (step as any).timing as FollowUpStepTiming;
    const scheduledAt = addDelay(
      enrollment.enrolledAt,
      timing.delayAmount,
      timing.delayUnit
    );

    await FollowUpScheduledEmail.findOrCreate({
      where: { enrollmentId: enrollment.id, stepId: step.id },
      defaults: {
        enrollmentId: enrollment.id,
        stepId: step.id,
        scheduledAt,
        status: "pending",
        attempts: 0,
      },
    });
  }
};

export const enrollCustomerInFollowUps = async (params: {
  customerAccountId: number;
  enrolledBy?: number | null;
}) => {
  const { customerAccountId, enrolledBy = null } = params;

  const account = await CustomerAccount.findByPk(customerAccountId, {
    include: [{ model: PortalCustomer, as: "portalCustomer", required: true }],
  });
  if (!account) throw new Error("Customer account not found");
  if (account.status !== "active") {
    return { enrolled: false, reason: "account_not_active" };
  }

  const sequence = await getActiveSequence();
  if (!sequence) return { enrolled: false, reason: "no_active_sequence" };

  const portalCustomer = (account as any).portalCustomer as PortalCustomer;
  if (!portalCustomer?.email?.trim()) {
    return { enrolled: false, reason: "missing_email" };
  }

  const [enrollment, created] = await FollowUpEnrollment.findOrCreate({
    where: {
      customerAccountId,
      sequenceId: sequence.id,
    },
    defaults: {
      customerAccountId,
      sequenceId: sequence.id,
      enrolledAt: new Date(),
      enrolledBy,
      status: "active",
    },
  });

  if (!created && enrollment.status !== "active") {
    await enrollment.update({ status: "active", enrolledAt: new Date() });
  }

  await scheduleEmailsForEnrollment(enrollment);

  return {
    enrolled: true,
    enrollmentId: enrollment.id,
    sequenceId: sequence.id,
    created,
  };
};

export const listFollowUpEnrollments = async ({
  page = 1,
  limit = 20,
  status,
  brandId,
}: {
  page?: number;
  limit?: number;
  status?: string;
  brandId?: number;
} = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const accountWhere: Record<string, unknown> = {};
  if (brandId != null && Number.isFinite(brandId)) {
    accountWhere.brandId = brandId;
  }

  const { rows, count } = await FollowUpEnrollment.findAndCountAll({
    where,
    order: [["enrolledAt", "DESC"]],
    limit: safeLimit,
    offset,
    include: [
      {
        model: CustomerAccount,
        as: "customerAccount",
        attributes: ["id", "status", "leadId", "brandId"],
        where: Object.keys(accountWhere).length ? accountWhere : undefined,
        required: Object.keys(accountWhere).length > 0,
        include: [
          {
            model: PortalCustomer,
            as: "portalCustomer",
            attributes: ["id", "email", "firstname", "lastname"],
          },
          {
            model: Brand,
            as: "brand",
            attributes: ["id", "name"],
          },
        ],
      },
      {
        model: FollowUpSequence,
        as: "sequence",
        attributes: ["id", "name"],
      },
    ],
  });

  const enrollmentIds = rows.map((row) => row.id);
  const scheduledRows = enrollmentIds.length
    ? await FollowUpScheduledEmail.findAll({
        where: { enrollmentId: { [Op.in]: enrollmentIds } },
        include: [
          {
            model: FollowUpStep,
            as: "step",
            attributes: ["id", "name", "sortOrder"],
          },
        ],
        order: [["scheduledAt", "ASC"]],
      })
    : [];

  const emailsByEnrollment = new Map<number, Array<Record<string, unknown>>>();
  for (const scheduled of scheduledRows) {
    const plain = scheduled.toJSON() as unknown as Record<string, unknown> & {
      step?: { name?: string; sortOrder?: number };
    };
    const list = emailsByEnrollment.get(scheduled.enrollmentId) || [];
    list.push({
      stepId: scheduled.stepId,
      stepName: plain.step?.name || `Step #${scheduled.stepId}`,
      sortOrder: plain.step?.sortOrder ?? 0,
      status: scheduled.status,
      scheduledAt: scheduled.scheduledAt,
      sentAt: scheduled.sentAt,
    });
    emailsByEnrollment.set(scheduled.enrollmentId, list);
  }

  const items = rows.map((row) => {
    const json = row.toJSON() as unknown as Record<string, unknown>;
    const emails = emailsByEnrollment.get(row.id) || [];
    const sent = emails.filter((e) => e.status === "sent").length;
    const pending = emails.filter(
      (e) => e.status === "pending" || e.status === "processing"
    ).length;
    const failed = emails.filter((e) => e.status === "failed").length;

    return {
      ...json,
      emailSummary: {
        total: emails.length,
        sent,
        pending,
        failed,
        emails,
      },
    };
  });

  return {
    items,
    total: count,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(count / safeLimit) || 1,
  };
};

export const getFollowUpStats = async () => {
  const [pending, sent, failed, activeEnrollments] = await Promise.all([
    FollowUpScheduledEmail.count({ where: { status: "pending" } }),
    FollowUpScheduledEmail.count({ where: { status: "sent" } }),
    FollowUpScheduledEmail.count({ where: { status: "failed" } }),
    FollowUpEnrollment.count({ where: { status: "active" } }),
  ]);

  return { pending, sent, failed, activeEnrollments };
};
