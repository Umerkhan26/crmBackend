import cron from "node-cron";
import {
  processDueFollowUpEmails,
  resumeStaleFollowUpProcessing,
} from "../services/followUpEmailProcessor.service";

const CRON_EXPR = process.env.FOLLOW_UP_EMAIL_CRON || "*/2 * * * *";

export const startFollowUpEmailCron = () => {
  resumeStaleFollowUpProcessing().catch((err) => {
    console.warn("follow-up email resume warning:", err?.message || err);
  });

  cron.schedule(CRON_EXPR, async () => {
    try {
      const result = await processDueFollowUpEmails();
      if (result.processed > 0) {
        console.log(`follow-up emails sent: ${result.processed}`);
      }
    } catch (err: any) {
      console.error("follow-up email cron error:", err?.message || err);
    }
  });

  console.log(`✅ Follow-up email cron scheduled (${CRON_EXPR})`);
};
