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

// Route files that need specific mount paths or load order
// IMPORTANT: More specific paths (e.g. /api/brands) must load BEFORE generic /api
// so /api/brands is not caught by a router with /api/:id
const ROUTE_PRIORITY: Record<string, { mount?: string; order?: number }> = {
  "brand.routes": { mount: "/api/brands", order: 0 },  // must be first - /api/brands before /api
  "user.routes": { order: 1 },  // login, register
  "role.routes": { order: 2 },  // /all
  "permission.routes": { order: 3 },
};

export const loadRoutes = (app: Application) => {
  const routesPath = path.join(__dirname, "src/routes");
  const files = fs.readdirSync(routesPath).filter(
    (f) => f.endsWith(".routes.js") || f.endsWith(".routes.ts")
  );
  const getOrder = (f: string) => ROUTE_PRIORITY[f.replace(/\.(routes\.(ts|js))$/, ".routes")]?.order ?? 99;
  files.sort((a, b) => getOrder(a) - getOrder(b));
  files.forEach((file) => {
    const routeModule = require(path.join(routesPath, file));
    const router = routeModule.default;
    const routeKey = file.replace(/\.(routes\.(ts|js))$/, ".routes");
    const config = ROUTE_PRIORITY[routeKey];

    if (router && typeof router === "function") {
      const mount = config?.mount || "/api";
      app.use(mount, router);
    } else {
      console.warn(`⚠️  Skipping ${file} — No valid default export found.`);
    }
  });
};

export default app;
