
import { Sequelize } from "sequelize";
import "./src/utils/loadEnv";
import { patchMissingSchemaColumns } from "./src/utils/patchSchemaColumns";

const db = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT as any,
    logging: false,
  }
);

export const connectDB = async () => {
  try {
    await db.authenticate();
    console.log("✅ Database connected successfully");

    await patchMissingSchemaColumns(db);

    // Sync database with error handling for missing constraints
    try {
      await db.sync({ alter: true });
      console.log("✅ All models synchronized");
    } catch (syncError: any) {
      // Handle constraint / index-limit errors gracefully
      const code = syncError?.original?.code || syncError?.parent?.code;
      const msg = String(syncError?.message || "");
      if (
        syncError.name === "SequelizeUnknownConstraintError" ||
        code === "ER_CANT_DROP_FIELD_OR_KEY" ||
        code === "ER_TOO_MANY_KEYS" ||
        /Too many keys/i.test(msg)
      ) {
        console.warn(
          "⚠️  Database sync warning (constraint/index issue, continuing):",
          syncError.message
        );
        // Try to sync without alter if alter fails
        try {
          await db.sync();
          console.log("✅ All models synchronized (without alter)");
        } catch (retryError) {
          console.warn("⚠️  Database sync retry warning (continuing anyway):", retryError);
        }
      } else {
        throw syncError; // Re-throw if it's a different error
      }
    }
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    throw error;
  }
};

export default db;
