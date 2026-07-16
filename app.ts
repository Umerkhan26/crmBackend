import express, { Application, ErrorRequestHandler, NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import "./src/models/associations";
import "./src/models/index";
import "./src/utils/reminderJob";
dotenv.config();

const app: Application = express();

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "50mb";
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
import { isAllowedPortalOrigin } from "./src/utils/portalHost";

export const buildAllowedOrigins = (): string[] => {
  const origins = new Set<string>([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  const frontEnd = process.env.FRONT_END_URL?.trim();
  if (frontEnd) origins.add(frontEnd);
  const portalUrl = process.env.CUSTOMER_PORTAL_URL?.trim();
  if (portalUrl) origins.add(portalUrl);
  const extra = process.env.CORS_ORIGINS || "";
  extra.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) origins.add(trimmed);
  });
  return [...origins];
};

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, origin);
        return;
      }
      if (isAllowedPortalOrigin(origin)) {
        callback(null, origin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-customer-host",
      "Cache-Control",
      "Pragma",
    ],
    methods: ["PUT", "POST", "GET", "DELETE", "PATCH", "OPTIONS"],
    maxAge: 1800,
  })
);

/** Customer email logos/favicons — crmBackend/public/ → /api/email-assets/Favicons/... */
const emailPublicCandidates = [
  path.join(__dirname, "public"),
  path.join(__dirname, "..", "public"),
];
const emailPublicDir =
  emailPublicCandidates.find((dir) =>
    fs.existsSync(path.join(dir, "Favicons"))
  ) || emailPublicCandidates[0];
app.use(
  "/api/email-assets",
  express.static(emailPublicDir, { maxAge: "7d", fallthrough: false })
);

export const emailAssetsPublicDir = emailPublicDir;

// Route files that need specific mount paths or load order
// IMPORTANT: More specific paths (e.g. /api/brands) must load BEFORE generic /api
// so /api/brands is not caught by a router with /api/:id
const ROUTE_PRIORITY: Record<string, { mount?: string; order?: number }> = {
  "brand.routes": { mount: "/api/brands", order: 0 },  // must be first - /api/brands before /api
  "customerEmailType.routes": { mount: "/api/customer-email-types", order: 0 },
  "customerArea.routes": { mount: "/api/customer-area", order: 0 },
  "customerAccount.routes": { mount: "/api/customer-accounts", order: 0 },
  "emailTrack.routes": { mount: "/api/email-track", order: 0 },
  "portalContent.routes": { mount: "/api/portal-content", order: 0 },
  "followUpEmail.routes": { mount: "/api/follow-up-emails", order: 0 },
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
      if (routeKey === "customerAccount.routes") {
        console.log(`   ↳ ${mount}/bulk-email (POST) registered`);
      }
    } else {
      console.warn(`⚠️  Skipping ${file} — No valid default export found.`);
    }
  });
};

const payloadTooLargeHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    res.status(413).json({
      success: false,
      message: `Payload too large. Increase REQUEST_BODY_LIMIT (current: ${requestBodyLimit}).`,
    });
    return;
  }
  next(err);
};

app.use(payloadTooLargeHandler);

export default app;
