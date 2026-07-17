import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * Load .env from project root even when PM2 cwd differs.
 * Tries cwd, then this file's parents (src/utils → root), then dist parents.
 */
export const loadEnv = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"), // src/utils → root
    path.resolve(__dirname, "../.env"), // dist/utils → root (if compiled flat)
    path.resolve(__dirname, ".env"),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return envPath;
    }
  }

  dotenv.config();
  return null;
};

loadEnv();
