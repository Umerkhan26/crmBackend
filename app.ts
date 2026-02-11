import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import "./src/models/associations";
import "./src/models/index";
import "./src/utils/reminderJob";
dotenv.config();

const app: Application = express();

app.use(express.json());
app.use(cors());
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

export const loadRoutes = (app: Application) => {
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

export default app;
