/**
 * Seed brand_email_senders from JSON (care / invoice / promotions per brand).
 *
 * Setup:
 *   1. npm run sync:brand-email-senders
 *   2. Copy src/scripts/data/brand-email-senders.seed.example.json
 *      to   src/scripts/data/brand-email-senders.seed.json
 *      Edit passwords / hosts if needed.
 *   3. npm run seed:brand-email-senders
 *
 * Optional: pass custom JSON path as first CLI arg.
 */
import fs from "fs";
import path from "path";
import db from "../../db";
import "../models/index";
import Brand from "../models/brand.model";
import { upsertBrandEmailSender } from "../services/brandEmailSender.service";
import type { CustomerEmailType } from "../constants/customerEmailTypes";

type SeedSender = {
  emailType: CustomerEmailType;
  smtpUser: string;
  smtpPassword: string;
  fromName?: string;
  replyTo?: string;
};

type SeedBrand = {
  brandSlug: string;
  brandName?: string;
  smtpHost: string;
  smtpPort?: number;
  senders: SeedSender[];
};

const defaultJsonPath = path.join(
  __dirname,
  "data",
  "brand-email-senders.seed.json"
);

const resolveJsonPath = (): string => {
  const arg = process.argv[2]?.trim();
  if (arg) return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  return defaultJsonPath;
};

const loadSeedFile = (filePath: string): SeedBrand[] => {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Seed file not found: ${filePath}\n` +
        `Copy brand-email-senders.seed.example.json to brand-email-senders.seed.json first.`
    );
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Seed JSON must be an array of brand objects");
  }
  return parsed as SeedBrand[];
};

const findBrand = async (entry: SeedBrand) => {
  const slug = entry.brandSlug?.trim().toLowerCase();
  if (slug) {
    const bySlug = await Brand.findOne({ where: { slug } });
    if (bySlug) return bySlug;
  }
  if (entry.brandName?.trim()) {
    const byName = await Brand.findOne({ where: { name: entry.brandName.trim() } });
    if (byName) return byName;
  }
  return null;
};

const run = async () => {
  const jsonPath = resolveJsonPath();
  console.log(`🚀 Seeding brand email senders from:\n   ${jsonPath}\n`);

  await db.authenticate();

  const BrandEmailSender = (await import("../models/brandEmailSender.model"))
    .default;
  await BrandEmailSender.sync({ alter: true });

  const entries = loadSeedFile(jsonPath);
  let saved = 0;
  let skipped = 0;

  for (const entry of entries) {
    const brand = await findBrand(entry);
    if (!brand) {
      console.warn(
        `   ⚠ Skipped — brand not found (slug=${entry.brandSlug}, name=${entry.brandName || "—"})`
      );
      skipped += entry.senders?.length || 0;
      continue;
    }

    console.log(`\n   Brand: ${brand.name} (id=${brand.id}, slug=${brand.slug})`);

    for (const sender of entry.senders || []) {
      if (!sender.smtpUser?.trim() || !sender.smtpPassword?.trim()) {
        console.warn(`      ⚠ Skipped ${sender.emailType} — missing user/password`);
        skipped += 1;
        continue;
      }

      await upsertBrandEmailSender({
        brandId: brand.id,
        emailType: sender.emailType,
        smtpHost: entry.smtpHost,
        smtpPort: entry.smtpPort ?? 465,
        smtpUser: sender.smtpUser,
        smtpPassword: sender.smtpPassword,
        fromName: sender.fromName,
        replyTo: sender.replyTo || sender.smtpUser,
        isActive: true,
      });

      console.log(`      ✓ ${sender.emailType} → ${sender.smtpUser}`);
      saved += 1;
    }
  }

  console.log(`\n✅ Done. Saved ${saved} sender(s), skipped ${skipped}.`);
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Seed failed:", err?.message || err);
  process.exit(1);
});
