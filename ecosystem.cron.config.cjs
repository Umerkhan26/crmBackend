/**
 * PM2 scheduled workers (one-shot scripts; autorestart: false; PM2 cron_restart runs the next invocation).
 *
 * - cron-assign-last-24h: daily 7:00 PM Asia/Karachi (same as your previous crontab).
 * - cron-rebalance-rotate: every 15 min — script reads rebalanceDays / tenure / rotationOrder from DB.
 *
 * Start:  npm run pm2:cron
 *          (or: pm2 start ecosystem.cron.config.cjs)
 * Save:   pm2 save
 *
 * IMPORTANT: Remove the two auto-assignment lines from `crontab -e` so jobs do not run twice.
 */
const path = require("path");

/** Logs next to repo: ../logs (e.g. /home/backendCrm/logs when app is in .../crmBackend) */
const logDir = path.join(__dirname, "..", "logs");

module.exports = {
  apps: [
    {
      name: "cron-assign-last-24h",
      cwd: __dirname,
      script: "npm",
      args: "run cron:assign-last-24h",
      autorestart: false,
      cron_restart: "0 19 * * *",
      env: {
        TZ: "Asia/Karachi",
        NODE_ENV: "production",
      },
      error_file: path.join(logDir, "crm-assign-pm2.log"),
      out_file: path.join(logDir, "crm-assign-pm2.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "cron-rebalance-rotate",
      cwd: __dirname,
      script: "npm",
      args: "run cron:rebalance-rotate",
      autorestart: false,
      cron_restart: "*/15 * * * *",
      env: {
        TZ: "Asia/Karachi",
        NODE_ENV: "production",
      },
      error_file: path.join(logDir, "crm-rebalance-pm2.log"),
      out_file: path.join(logDir, "crm-rebalance-pm2.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
