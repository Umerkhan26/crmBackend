// // db.ts
// import { Sequelize } from "sequelize";
// import dotenv from "dotenv";

// dotenv.config();

// const db = new Sequelize("crm", "root", "", {
//   host: process.env.DB_HOST,
//   dialect: "mysql",
//   logging:false
// });

// export const connectDB = async () => {
//   try {
//     await db.authenticate();
//     console.log("✅ Database connected successfully");

//     await db.sync({ force: true }); // This will create all tables
//     console.log("✅ All models synchronized");
//   } catch (error) {
//     console.error("❌ Unable to connect to the database:", error);
//     throw error;
//   }
// };

// export default db;



// db.ts
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const db = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASS || "", // allow empty password
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT as any, // mysql / postgres etc
    logging: false,
  }
);

export const connectDB = async () => {
  try {
    await db.authenticate();
    console.log("✅ Database connected successfully");

    // Warning: force: true will DROP and recreate tables every time!
    await db.sync({ alter: true });
    console.log("✅ All models synchronized");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    throw error;
  }
};

export default db;
