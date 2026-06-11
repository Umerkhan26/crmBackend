/**
 * Full cleanup: portal_customers schema + drop legacy userId columns/rows.
 * Run on server: npm run migrate:portal-customers
 */

import db from "../../db";
import "../models/index";
import {
  columnExists,
  ensurePortalCustomerIdForeignKey,
  ensurePortalCustomersSchema,
  migratePortalRelatedUserIdColumns,
  removeLegacyCustomerAccountUserIdColumn,
  tableExists,
} from "./lib/portalCustomersSchema";

const run = async () => {
  await db.authenticate();
  console.log("🚀 Migrating customers out of users table...\n");

  const userToPortal = await ensurePortalCustomersSchema();
  await migratePortalRelatedUserIdColumns(userToPortal);
  const hasLegacyUserId = await columnExists("customer_accounts", "userId");

  if (userToPortal.size > 0) {
    const legacyUserIds = [...userToPortal.keys()];
    await db.query(
      `
      DELETE FROM users
      WHERE id IN (?)
        AND LOWER(COALESCE(userrole, '')) IN ('customer', 'client')
      `,
      { replacements: [legacyUserIds] }
    );
    console.log(`   ✓ Removed legacy customer row(s) from users`);
  }

  if (hasLegacyUserId) {
    await removeLegacyCustomerAccountUserIdColumn();
  } else {
    console.log("   ✓ customer_accounts already uses portalCustomerId only");
  }

  await ensurePortalCustomerIdForeignKey();

  if (await tableExists("portal_activity_events")) {
    const PortalActivityEvent = (
      await import("../models/portalActivityEvent.model")
    ).default;
    await PortalActivityEvent.sync({ alter: true });
  }

  if (await tableExists("portal_popup_dismissals")) {
    const PortalPopupDismissal = (
      await import("../models/portalPopupDismissal.model")
    ).default;
    await PortalPopupDismissal.sync({ alter: true });
  }

  const CustomerAccount = (await import("../models/customerAccount.model")).default;
  await CustomerAccount.sync({ alter: true });

  console.log("\n✅ Portal customer migration complete.");
  console.log("   Customers must log in again (new portal token type).");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
