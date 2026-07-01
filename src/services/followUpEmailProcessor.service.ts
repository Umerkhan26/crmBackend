import { Op } from "sequelize";
import "../models/associations";
import FollowUpScheduledEmail from "../models/followUpScheduledEmail.model";
import FollowUpEnrollment from "../models/followUpEnrollment.model";
import FollowUpStep from "../models/followUpStep.model";
import FollowUpStepTiming from "../models/followUpStepTiming.model";
import FollowUpSequence from "../models/followUpSequence.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import EmailLog from "../models/emailLog.model";
import CustomerEngagement from "../models/customerEngagement.model";
import { customerEngagementEmailTemplate } from "../Templetes/customerEngagementEmailTemplate";
import { sendCustomerPortalEmail } from "../utils/customerPortalEmail";
import {
  CUSTOMER_EMAIL_TYPE_DEFAULTS,
  parseCustomerEmailType,
  type CustomerEmailType,
} from "../constants/customerEmailTypes";
import { getCustomerEmailBrandTheme } from "../utils/customerEmailBrandTheme";
import { fillTemplate } from "../utils/fillTemplate";
import { logLeadActivity } from "../utils/logLeadActivity";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 30;
let processorRunning = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getFollowUpEmailDelayMs = (): number => {
  const raw = Number(process.env.FOLLOW_UP_EMAIL_DELAY_MS || "2000");
  return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
};

const claimNextDueEmail = async (): Promise<FollowUpScheduledEmail | null> => {
  const now = new Date();
  const candidate = await FollowUpScheduledEmail.findOne({
    where: {
      status: "pending",
      scheduledAt: { [Op.lte]: now },
    },
    order: [["scheduledAt", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: FollowUpEnrollment,
        as: "enrollment",
        where: { status: "active" },
        required: true,
        include: [
          {
            model: FollowUpSequence,
            as: "sequence",
            where: { isActive: true },
            required: true,
          },
        ],
      },
      {
        model: FollowUpStep,
        as: "step",
        where: { isActive: true },
        required: true,
      },
    ],
  });

  if (!candidate) return null;

  const [updated] = await FollowUpScheduledEmail.update(
    { status: "processing" },
    { where: { id: candidate.id, status: "pending" } }
  );

  if (!updated) return claimNextDueEmail();
  return candidate.reload({
    include: [
      {
        model: FollowUpEnrollment,
        as: "enrollment",
        required: true,
        include: [{ model: FollowUpSequence, as: "sequence", required: true }],
      },
      { model: FollowUpStep, as: "step", required: true },
    ],
  });
};

const markEnrollmentCompletedIfDone = async (enrollmentId: number) => {
  const remaining = await FollowUpScheduledEmail.count({
    where: {
      enrollmentId,
      status: { [Op.in]: ["pending", "processing"] },
    },
  });
  if (remaining === 0) {
    await FollowUpEnrollment.update(
      { status: "completed" },
      { where: { id: enrollmentId, status: "active" } }
    );
  }
};

const processOneScheduledEmail = async (scheduled: FollowUpScheduledEmail) => {
  const enrollment = (scheduled as any).enrollment as FollowUpEnrollment;
  const step = (scheduled as any).step as FollowUpStep;
  const sequence = (enrollment as any).sequence as FollowUpSequence | undefined;
  const emailType: CustomerEmailType = sequence?.emailType
    ? parseCustomerEmailType(sequence.emailType, CUSTOMER_EMAIL_TYPE_DEFAULTS.followUp)
    : CUSTOMER_EMAIL_TYPE_DEFAULTS.followUp;

  const timing = await FollowUpStepTiming.findOne({
    where: { stepId: step.id, isActive: true },
  });
  if (!timing) {
    await scheduled.update({ status: "skipped", lastError: "timing_inactive" });
    await markEnrollmentCompletedIfDone(enrollment.id);
    return;
  }

  const account = await CustomerAccount.findByPk(enrollment.customerAccountId, {
    include: [{ model: PortalCustomer, as: "portalCustomer", required: true }],
  });

  if (!account || account.status !== "active") {
    await scheduled.update({
      status: "skipped",
      lastError: "customer_account_inactive",
    });
    await markEnrollmentCompletedIfDone(enrollment.id);
    return;
  }

  const portalCustomer = (account as any).portalCustomer as PortalCustomer;
  const email = portalCustomer.email?.trim();
  if (!email) {
    await scheduled.update({ status: "skipped", lastError: "missing_email" });
    await markEnrollmentCompletedIfDone(enrollment.id);
    return;
  }

  const templateData = {
    firstname: portalCustomer.firstname || "",
    lastname: portalCustomer.lastname || "",
    email,
  };

  const subject = fillTemplate(step.subject, templateData);
  const bodyPlain = fillTemplate(step.body, templateData);
  const theme = await getCustomerEmailBrandTheme(account.brandId);
  const { subject: mailSubject, html } = customerEngagementEmailTemplate({
    firstname: portalCustomer.firstname,
    lastname: portalCustomer.lastname,
    subject,
    body: bodyPlain,
    theme,
  });

  await sendCustomerPortalEmail({
    to: email,
    subject: mailSubject,
    body: html,
    theme,
    brandId: account.brandId,
    emailType,
  });

  await EmailLog.create({
    to: email,
    subject: mailSubject,
    body: html,
    status: "sent",
    serviceName: `follow_up_step_${step.id}`,
    sentAt: new Date(),
  });

  const createdBy = enrollment.enrolledBy || 1;
  await CustomerEngagement.create({
    customerAccountId: account.id,
    type: "promotional_email",
    title: mailSubject,
    details: bodyPlain,
    metadata: {
      followUp: true,
      stepId: step.id,
      stepName: step.name,
      scheduledEmailId: scheduled.id,
      enrollmentId: enrollment.id,
    },
    status: "sent",
    createdBy,
  });

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_follow_up_email_sent",
      performedBy: createdBy,
      details: `${step.name}: ${mailSubject}`,
    });
  }

  await scheduled.update({
    status: "sent",
    sentAt: new Date(),
    lastError: null,
  });

  await markEnrollmentCompletedIfDone(enrollment.id);
};

const failScheduledEmail = async (
  scheduled: FollowUpScheduledEmail,
  errorMsg: string,
  final: boolean
) => {
  await scheduled.update({
    status: final ? "failed" : "pending",
    lastError: errorMsg.slice(0, 2000),
    attempts: scheduled.attempts + 1,
  });
};

export const processDueFollowUpEmails = async () => {
  if (processorRunning) return { processed: 0, skipped: true };
  processorRunning = true;

  let processed = 0;
  const delayMs = getFollowUpEmailDelayMs();

  try {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const scheduled = await claimNextDueEmail();
      if (!scheduled) break;

      try {
        await processOneScheduledEmail(scheduled);
        processed += 1;
      } catch (err: any) {
        const msg = err?.message || String(err);
        const nextAttempts = scheduled.attempts + 1;
        const final = nextAttempts >= MAX_ATTEMPTS;
        await failScheduledEmail(scheduled, msg, final);
      }

      if (delayMs > 0 && i < BATCH_SIZE - 1) {
        await delay(delayMs);
      }
    }
  } finally {
    processorRunning = false;
  }

  return { processed, skipped: false };
};

export const resumeStaleFollowUpProcessing = async () => {
  await FollowUpScheduledEmail.update(
    { status: "pending" },
    { where: { status: "processing" } }
  );
};
