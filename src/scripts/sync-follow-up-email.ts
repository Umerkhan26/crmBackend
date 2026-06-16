/**
 * Sync follow-up email tables and seed default sequence.
 * Run: npm run sync:follow-up-email
 */

import db from "../../db";
import "../models/index";

const DEFAULT_STEPS = [
  {
    name: "3 Day Check-in",
    sortOrder: 1,
    subject: "Checking in, {{firstname}}",
    body: "<p>Hi {{firstname}},</p><p>It has been a few days since you joined us. Let us know if you have any questions.</p>",
    delayAmount: 3,
    delayUnit: "days" as const,
  },
  {
    name: "7 Day Follow-up",
    sortOrder: 2,
    subject: "How are things going, {{firstname}}?",
    body: "<p>Hi {{firstname}},</p><p>We wanted to follow up and see how your experience has been so far.</p>",
    delayAmount: 7,
    delayUnit: "days" as const,
  },
  {
    name: "2 Week Follow-up",
    sortOrder: 3,
    subject: "Two weeks in — {{firstname}}",
    body: "<p>Hi {{firstname}},</p><p>It has been two weeks. We are here if you need anything.</p>",
    delayAmount: 14,
    delayUnit: "days" as const,
  },
  {
    name: "1 Month Follow-up",
    sortOrder: 4,
    subject: "One month with us, {{firstname}}",
    body: "<p>Hi {{firstname}},</p><p>Thank you for being with us for a month. We would love your feedback.</p>",
    delayAmount: 30,
    delayUnit: "days" as const,
  },
];

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing follow-up email tables...\n");

  const FollowUpSequence = (await import("../models/followUpSequence.model"))
    .default;
  const FollowUpStep = (await import("../models/followUpStep.model")).default;
  const FollowUpStepTiming = (await import("../models/followUpStepTiming.model"))
    .default;
  const FollowUpEnrollment = (await import("../models/followUpEnrollment.model"))
    .default;
  const FollowUpScheduledEmail = (
    await import("../models/followUpScheduledEmail.model")
  ).default;

  await FollowUpSequence.sync({ alter: true });
  console.log("   ✓ follow_up_sequences synced");

  await FollowUpStep.sync({ alter: true });
  console.log("   ✓ follow_up_steps synced");

  await FollowUpStepTiming.sync({ alter: true });
  console.log("   ✓ follow_up_step_timings synced");

  await FollowUpEnrollment.sync({ alter: true });
  console.log("   ✓ follow_up_enrollments synced");

  await FollowUpScheduledEmail.sync({ alter: true });
  console.log("   ✓ follow_up_scheduled_emails synced");

  let sequence = await FollowUpSequence.findOne({
    where: { trigger: "customer_provisioned" },
  });

  if (!sequence) {
    sequence = await FollowUpSequence.create({
      name: "Customer onboarding follow-ups",
      trigger: "customer_provisioned",
      isActive: true,
    });
    console.log("\n   ✓ Default follow-up sequence created");

    for (const step of DEFAULT_STEPS) {
      const createdStep = await FollowUpStep.create({
        sequenceId: sequence.id,
        name: step.name,
        sortOrder: step.sortOrder,
        subject: step.subject,
        body: step.body,
        isActive: true,
      });
      await FollowUpStepTiming.create({
        stepId: createdStep.id,
        delayAmount: step.delayAmount,
        delayUnit: step.delayUnit,
        isActive: true,
      });
    }
    console.log("   ✓ Default follow-up steps + timings seeded");
  } else {
    console.log("\n   ℹ Default sequence already exists — skipped seed");
  }

  console.log("\n✅ Follow-up email schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
