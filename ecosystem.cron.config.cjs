root@eraxon:/home/backendCrm/crmBackend# cat ecosystem.cron.config.cjs 
/**
 * PM2 scheduled workers (one-shot scripts; autorestart: false; PM2 cron_restart runs the next invocation).
 *
 * - cron-assign-last-24h: daily 7:00 PM Asia/Karachi
 * - cron-rebalance-rotate: every 15 min — script reads rebalanceDays / DB
 *
 * Start:  npm run pm2:cron
 * Save:   pm2 save
 */
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

module.exports = {
  apps: [
    {
      name: "cron-assign-last-24h",
      cwd: __dirname,
      script: "npm",
      args: "run cron:assign-last-24h",
 
     autorestart: false,
cron_restart: "0 14 * * 1-5",
//  cron_restart: "0 14 * * *", 

//      cron_restart: "0 19 * * *",
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
//      cron_restart: "*/15 * * * *",
cron_restart: "*/15 * * * 1-5",  
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