
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

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

    await db.sync({ alter: true });
    console.log("✅ All models synchronized");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    throw error;
  }
};

export default db;
