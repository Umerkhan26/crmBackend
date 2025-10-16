import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { syncPermissionsToDB } from "./src/utils/syncPermissions";
import { syncEmailPermissionsToDB } from "./src/utils/syncEmailPermissions";
import db from "./db";
import "./src/models/associations";
import "./src/models/index";
import "./src/utils/reminderJob";
dotenv.config();

const app: Application = express();

// Middleware
app.use(express.json());
app.use(cors());

// Custom CORS Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const allowedOrigin = process.env.FRONT_END_URL || "http://localhost:3001";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "1800");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "PUT, POST, GET, DELETE, PATCH, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

// Load routes dynamically (support .js and .ts files)
const loadRoutes = (app: Application) => {
  const routesPath = path.join(__dirname, "src/routes");
  fs.readdirSync(routesPath).forEach((file) => {
    if (file.endsWith(".routes.js") || file.endsWith(".routes.ts")) {
      const routeModule = require(path.join(routesPath, file));
      const router = routeModule.default;

      if (router && typeof router === "function") {
        app.use("/api", router);
      } else {
        console.warn(`⚠️  Skipping ${file} — No valid default export found.`);
      }
    }
  });
};

// Initialize app
const startServer = async () => {
  try {
    await db.sync({ alter: true }); // 🟢 Sync all models
    console.log("Database synced.");

    await syncPermissionsToDB(); // ✅ Sync standard permissions
    console.log("Permissions synced to database.");

    await syncEmailPermissionsToDB(); // ✅ Sync email-specific permissions
    console.log("Email permissions synced to database.");

    loadRoutes(app);
    console.log("App initialized.");
  } catch (err) {
    console.error("App startup error:", err);
    process.exit(1);
  }
};

startServer();

export default app;
