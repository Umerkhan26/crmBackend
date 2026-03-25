/**
 * Quick script to check which lead permissions exist in the database
 * Run: npx ts-node src/scripts/check-lead-permissions.ts
 */

import db from "../../db";
import "../models/index";

const checkLeadPermissions = async () => {
  try {
    await db.authenticate();
    console.log("✅ Database connected.\n");

    const leadPermissions = [
      "lead:create",
      "lead:getAll",
      "lead:viewAll",
      "lead:getByCampaign",
      "lead:update",
      "lead:delete",
      "assignedLead:getByAssignee",
      "assignedLead:getByCampaignAndAssignee",
      "assignedLead:get_status_summary",
      "assignedLead:update_status",
    ];

    const [results] = await db.query(`
      SELECT name, COUNT(*) as count
      FROM permissions
      WHERE name IN (${leadPermissions.map(() => '?').join(',')})
      GROUP BY name
      ORDER BY name
    `, {
      replacements: leadPermissions
    });

    const foundPerms = Array.isArray(results) ? (results as any[]) : [];
    const foundNames = foundPerms.map((r: any) => r.name);
    const missing = leadPermissions.filter(p => !foundNames.includes(p));

    console.log("📋 Lead Permissions Status:\n");
    
    if (foundPerms.length > 0) {
      console.log("✅ Found permissions:");
      foundPerms.forEach((r: any) => {
        const count = r.count > 1 ? ` (${r.count} duplicates)` : '';
        console.log(`   ✓ ${r.name}${count}`);
      });
    }

    if (missing.length > 0) {
      console.log("\n❌ Missing permissions:");
      missing.forEach(p => {
        console.log(`   ✗ ${p}`);
        if (p === "lead:viewAll") {
          console.log(`      ⚠️  IMPORTANT: This permission is needed for viewing all leads!`);
        }
      });
    } else {
      console.log("\n✅ All lead permissions are present in the database!");
    }

    console.log(`\n📊 Summary: ${foundPerms.length}/${leadPermissions.length} permissions found`);
    
    if (missing.length > 0) {
      console.log(`\n💡 To add missing permissions, run: ts-node src/scripts/sync-permissions.ts`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await db.close();
  }
};

checkLeadPermissions()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
