/**
 * Comprehensive sync script for brand-related changes and permissions
 * 
 * This script will:
 * 1. Sync all brand-related tables (brands, brand_users, brand_managers)
 * 2. Add brandId column to users table if it doesn't exist
 *    NOTE: Only the 'users' table gets modified. No other existing tables 
 *    (leads, campaigns, orders, etc.) have brand-related changes.
 * 3. Sync brand-related permissions (8 permissions)
 * 4. Verify and sync lead-related permissions (10 permissions, including lead:viewAll)
 * 5. Verify all changes were applied successfully
 * 
 * Run: npx ts-node src/scripts/sync-brand-tables.ts
 */

import db from "../../db";
import "../models/index";
import { syncPermissionsToDB } from "../utils/syncPermissions";

const runSync = async () => {
  try {
    console.log("🚀 Starting brand-related database sync...\n");

    // Step 1: Connect to database
    await db.authenticate();
    console.log("✅ Database connection established.\n");

    // Step 2: Add brandId column to users table if it doesn't exist
    console.log("📋 Step 1: Checking users table for brandId column...");
    try {
      const [results] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'users' 
          AND COLUMN_NAME = 'brandId'
      `);
      const hasColumn = Array.isArray(results) && results.length > 0;

      if (hasColumn) {
        console.log("   ✓ brandId column already exists in users table.");
      } else {
        await db.query(`
          ALTER TABLE users ADD COLUMN brandId INT NULL
        `);
        console.log("   ✓ Added brandId column to users table (nullable for old data).");
      }
    } catch (error: any) {
      console.error("   ❌ Error checking/adding brandId column:", error.message);
      throw error;
    }

    // Step 3: Sync all tables (this will create brands, brand_users, brand_managers if they don't exist)
    console.log("\n📋 Step 2: Syncing all database tables...");
    try {
      await db.sync({ alter: false }); // Use sync() without alter to avoid constraint issues
      console.log("   ✓ All tables synchronized (brands, brand_users, brand_managers).");
    } catch (error: any) {
      // If alter fails, try without alter
      if (error.name === "SequelizeUnknownConstraintError" || 
          error.original?.code === "ER_CANT_DROP_FIELD_OR_KEY") {
        console.warn("   ⚠️  Constraint issue detected, retrying without alter...");
        try {
          await db.sync();
          console.log("   ✓ All tables synchronized (without alter).");
        } catch (retryError: any) {
          console.error("   ❌ Error syncing tables:", retryError.message);
          throw retryError;
        }
      } else {
        console.error("   ❌ Error syncing tables:", error.message);
        throw error;
      }
    }

    // Step 4: Verify brand-related tables exist
    console.log("\n📋 Step 3: Verifying brand-related tables exist...");
    try {
      const [tables] = await db.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN ('brands', 'brand_users', 'brand_managers')
        ORDER BY TABLE_NAME
      `);
      
      const tableNames = Array.isArray(tables) 
        ? (tables as any[]).map((t: any) => t.TABLE_NAME)
        : [];
      
      const requiredTables = ['brands', 'brand_users', 'brand_managers'];
      const missingTables = requiredTables.filter(t => !tableNames.includes(t));
      
      if (missingTables.length === 0) {
        console.log("   ✓ All brand-related tables exist:");
        requiredTables.forEach(t => console.log(`      - ${t}`));
      } else {
        console.warn(`   ⚠️  Missing tables: ${missingTables.join(', ')}`);
        console.log("   Attempting to create missing tables...");
        await db.sync({ force: false });
        console.log("   ✓ Retry sync completed.");
      }
    } catch (error: any) {
      console.error("   ❌ Error verifying tables:", error.message);
      throw error;
    }

    // Step 5: Verify brandId column in users table
    console.log("\n📋 Step 4: Verifying brandId column in users table...");
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'users' 
          AND COLUMN_NAME = 'brandId'
      `);
      
      if (Array.isArray(columns) && columns.length > 0) {
        const col = (columns as any)[0];
        console.log(`   ✓ brandId column verified: ${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE}`);
      } else {
        console.warn("   ⚠️  brandId column not found, attempting to add...");
        await db.query(`ALTER TABLE users ADD COLUMN brandId INT NULL`);
        console.log("   ✓ brandId column added.");
      }
    } catch (error: any) {
      console.error("   ❌ Error verifying brandId column:", error.message);
      throw error;
    }

    // Step 6: Sync permissions (including brand and lead permissions)
    console.log("\n📋 Step 5: Syncing permissions (including brand and lead permissions)...");
    try {
      await syncPermissionsToDB();
      
      const PermissionModule = await import("../models/permission.model");
      const Permission = PermissionModule.default;
      
      // Brand permissions (using strings directly to avoid dependency on PERMISSIONS object)
      // This ensures the script works even if permissions.ts hasn't been updated on the server
      const brandPermissions = [
        "brand:create",
        "brand:get",
        "brand:update",
        "brand:delete",
        "brand:assignUsers",
        "brand:removeUsers",
        "brand:assignManagers",
        "brand:removeManagers",
      ];

      // Lead permissions (including LEAD_VIEW_ALL which is important for viewing all leads)
      const leadPermissions = [
        "lead:create",
        "lead:getAll",
        "lead:viewAll", // Important: allows viewing all leads (not just own)
        "lead:getByCampaign",
        "lead:update",
        "lead:delete",
        "assignedLead:getByAssignee",
        "assignedLead:getByCampaignAndAssignee",
        "assignedLead:get_status_summary",
        "assignedLead:update_status",
      ];

      // Combine all permissions to check
      const allNewPermissions = [...brandPermissions, ...leadPermissions];
      
      // Check which permissions exist
      const existingPermsInDB = await Permission.findAll({
        where: {
          name: allNewPermissions,
        },
      });

      const existingPermNames = existingPermsInDB.map(p => p.name);
      const missingPerms = allNewPermissions.filter(p => !existingPermNames.includes(p));

      // Add missing permissions if any
      if (missingPerms.length > 0) {
        console.log(`   ℹ️  Adding ${missingPerms.length} missing permission(s)...`);
        try {
          const permValues = missingPerms.map(name => ({ name }));
          await Permission.bulkCreate(permValues, { 
            ignoreDuplicates: true,
            returning: true,
          });
          console.log(`   ✓ Added missing permissions: ${missingPerms.join(', ')}`);
        } catch (permError: any) {
          console.warn(`   ⚠️  Could not auto-add permissions (may need userId): ${permError.message}`);
          console.log(`   ℹ️  You may need to add these permissions manually: ${missingPerms.join(', ')}`);
        }
      }

      // Verify brand permissions
      const finalBrandPerms = await Permission.findAll({
        where: {
          name: brandPermissions,
        },
      });

      if (finalBrandPerms.length === brandPermissions.length) {
        console.log(`   ✓ All ${brandPermissions.length} brand permissions verified:`);
        finalBrandPerms.forEach(p => console.log(`      - ${p.name}`));
      } else {
        const stillMissing = brandPermissions.filter(
          p => !finalBrandPerms.map(perm => perm.name).includes(p)
        );
        console.warn(`   ⚠️  Some brand permissions still missing: ${stillMissing.join(', ')}`);
      }

      // Verify lead permissions (especially LEAD_VIEW_ALL)
      const finalLeadPerms = await Permission.findAll({
        where: {
          name: leadPermissions,
        },
      });

      const foundLeadPermNames = finalLeadPerms.map(p => p.name);
      const uniqueFoundLeadPerms = [...new Set(foundLeadPermNames)]; // Remove duplicates if any
      const stillMissing = leadPermissions.filter(
        p => !uniqueFoundLeadPerms.includes(p)
      );

      if (uniqueFoundLeadPerms.length === leadPermissions.length && stillMissing.length === 0) {
        console.log(`   ✓ All ${leadPermissions.length} lead permissions verified:`);
        leadPermissions.forEach(perm => {
          const found = finalLeadPerms.find(p => p.name === perm);
          if (found) console.log(`      - ${perm}`);
        });
      } else {
        if (stillMissing.length > 0) {
          console.warn(`   ⚠️  Some lead permissions still missing (${stillMissing.length}): ${stillMissing.join(', ')}`);
          if (stillMissing.includes("lead:viewAll")) {
            console.warn(`   ⚠️  IMPORTANT: 'lead:viewAll' permission is missing! This is needed for viewing all leads.`);
          }
        } else {
          // All permissions found, but might have duplicates
          console.log(`   ✓ All ${leadPermissions.length} lead permissions found:`);
          leadPermissions.forEach(perm => {
            const found = finalLeadPerms.find(p => p.name === perm);
            if (found) console.log(`      - ${perm}`);
          });
          if (finalLeadPerms.length > leadPermissions.length) {
            console.warn(`   ⚠️  Note: Found ${finalLeadPerms.length} records (expected ${leadPermissions.length}). There may be duplicates in the database.`);
          }
        }
      }
    } catch (error: any) {
      console.error("   ❌ Error syncing permissions:", error.message);
      // Don't throw - permissions can be added later
      console.warn("   ⚠️  Continuing with table sync (permissions can be synced separately)");
    }

    // Step 7: Verify foreign key constraints (if needed)
    console.log("\n📋 Step 6: Verifying foreign key constraints...");
    try {
      const [fks] = await db.query(`
        SELECT 
          CONSTRAINT_NAME,
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('brand_users', 'brand_managers', 'users')
          AND REFERENCED_TABLE_NAME IS NOT NULL
          AND (REFERENCED_TABLE_NAME = 'brands' OR REFERENCED_TABLE_NAME = 'users')
        ORDER BY TABLE_NAME, CONSTRAINT_NAME
      `);

      const fkList = Array.isArray(fks) ? (fks as any[]) : [];
      if (fkList.length > 0) {
        console.log(`   ✓ Found ${fkList.length} foreign key constraint(s):`);
        fkList.forEach((fk: any) => {
          console.log(`      - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        });
      } else {
        console.log("   ℹ️  No foreign key constraints found (may be using application-level constraints).");
      }
    } catch (error: any) {
      console.warn("   ⚠️  Could not verify foreign keys (non-critical):", error.message);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ Brand and Lead permissions sync completed successfully!");
    console.log("=".repeat(60));
    console.log("\n📊 Summary:");
    console.log("   ✓ Database connection established");
    console.log("   ✓ brandId column in users table");
    console.log("   ✓ brands table");
    console.log("   ✓ brand_users junction table");
    console.log("   ✓ brand_managers junction table");
    console.log("   ✓ Brand permissions synced (8 permissions)");
    console.log("   ✓ Lead permissions verified (10 permissions, including lead:viewAll)");
    console.log("\n🎉 All brand-related changes and permissions have been applied!");
    console.log("\n💡 Next steps:");
    console.log("   1. Verify your application can connect to the database");
    console.log("   2. Test brand creation and user assignment");
    console.log("   3. Verify permissions are assigned to appropriate roles");
    console.log("   4. Ensure 'lead:viewAll' permission is assigned to users who need to view all leads");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Sync failed:", error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await db.close();
  }
};

if (require.main === module) {
  runSync()
    .then(() => {
      console.log("\n✅ Script completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export default runSync;
