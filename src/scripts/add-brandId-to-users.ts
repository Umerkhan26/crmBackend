/**
 * Add brandId column to users table (nullable for old data).
 * Run: npx ts-node src/scripts/add-brandId-to-users.ts
 */

import db from "../../db";

const run = async () => {
  try {
    await db.authenticate();
    console.log("Database connected.");

    const [results] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'brandId'
    `);
    const hasColumn = Array.isArray(results) && results.length > 0;

    if (hasColumn) {
      console.log("Column brandId already exists in users table.");
      return;
    }

    await db.query(`
      ALTER TABLE users ADD COLUMN brandId INT NULL
    `);
    console.log("✅ Added brandId column to users table (nullable for old data).");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await db.close();
  }
};

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
