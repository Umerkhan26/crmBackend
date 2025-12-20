/**
 * Script to add "datascrapper" role to the database
 * Run this script using: npx ts-node src/scripts/add-datascrapper-role.ts
 * Or import and call it from your application startup
 */

import db from "../../db";
import Role from "../models/role.model";

const addDataScrapperRole = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    // Check if role already exists
    const existingRole = await Role.findOne({
      where: { name: "datascrapper" },
    });

    if (existingRole) {
      console.log("Role 'datascrapper' already exists in the database.");
      return existingRole;
    }

    // Create the new role
    const newRole = await Role.create({
      name: "datascrapper",
      description: "Data Scrapper role for users who scrape data",
    });

    console.log("Role 'datascrapper' created successfully:", newRole.toJSON());
    return newRole;
  } catch (error: any) {
    console.error("Error adding datascrapper role:", error.message);
    throw error;
  } finally {
    await db.close();
  }
};

// Run if executed directly
if (require.main === module) {
  addDataScrapperRole()
    .then(() => {
      console.log("Script completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

export default addDataScrapperRole;

