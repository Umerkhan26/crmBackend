/**
 * Local smoke test: duplicate detection (phone / email / Main Image) per campaign.
 *
 * Run (from D:\crmBackend):
 *   npx ts-node src/scripts/check-lead-duplicates.ts
 *   npx ts-node src/scripts/check-lead-duplicates.ts "Fiverr Lead Reference"
 *   npx ts-node src/scripts/check-lead-duplicates.ts "Fiverr Lead Reference" --incoming
 */

import db from "../../db";
import "../models/index";
import Lead from "../models/lead.model";
import IncomingLead from "../models/incomingLead.model";
import {
  annotateLeadsWithDuplicates,
  buildCampaignDuplicateIndexes,
  extractLeadDuplicateIdentity,
} from "../utils/leadDuplicate";

const campaignArg = process.argv
  .slice(2)
  .find((a) => a && !a.startsWith("--"));
const includeIncoming = process.argv.includes("--incoming");
const campaignName = (campaignArg || "Fiverr Lead Reference").trim();

async function main() {
  await db.authenticate();
  console.log("✅ DB connected\n");
  console.log(`Campaign: ${campaignName}`);
  console.log(`Include incoming staging: ${includeIncoming ? "yes" : "no"}\n`);

  const leads = await Lead.findAll({
    attributes: ["id", "campaignName", "leadData"],
    where: { campaignName },
    raw: true,
  });

  let incoming: Array<{
    id: number;
    campaignName: string | null;
    payload: unknown;
  }> = [];

  if (includeIncoming) {
    incoming = (await IncomingLead.findAll({
      attributes: ["id", "campaignName", "payload"],
      where: { campaignName },
      raw: true,
    })) as any[];
  }

  const identityRows = [
    ...leads.map((l: any) => ({
      id: l.id,
      campaignName: l.campaignName,
      leadData: l.leadData,
    })),
    ...incoming.map((r) => ({
      id: `incoming-${r.id}`,
      campaignName: r.campaignName || campaignName,
      payload: r.payload,
    })),
  ];

  console.log(`Master/promoted leads: ${leads.length}`);
  if (includeIncoming) {
    console.log(`Incoming staging rows: ${incoming.length}`);
  }
  console.log(`Total identity rows: ${identityRows.length}\n`);

  if (identityRows.length === 0) {
    console.log("⚠️ No rows found for this campaign. Check the campaign name.");
    return;
  }

  // Sample first 3 identities (debug field extraction)
  console.log("--- Sample identity extract (first 3) ---");
  for (const row of identityRows.slice(0, 3)) {
    const blob = (row as any).leadData ?? (row as any).payload;
    const idn = extractLeadDuplicateIdentity(blob);
    console.log(`  id=${row.id}`, {
      phone: idn.phone || "(empty)",
      email: idn.email || "(empty)",
      mainImage: idn.mainImage
        ? `${idn.mainImage.slice(0, 60)}${idn.mainImage.length > 60 ? "…" : ""}`
        : "(empty)",
    });
  }
  console.log("");

  const indexes = buildCampaignDuplicateIndexes(identityRows);
  const annotated = annotateLeadsWithDuplicates(identityRows, indexes);
  const duplicates = annotated.filter((r) => r.isDuplicate);

  const byMatch = { phone: 0, email: 0, image: 0 };
  for (const row of duplicates) {
    for (const m of row.duplicateMatchOn) {
      byMatch[m] += 1;
    }
  }

  console.log("--- Summary ---");
  console.log(`Total rows:      ${annotated.length}`);
  console.log(`Duplicates:      ${duplicates.length}`);
  console.log(`Unique (rest):   ${annotated.length - duplicates.length}`);
  console.log(`Match on phone:  ${byMatch.phone}`);
  console.log(`Match on email:  ${byMatch.email}`);
  console.log(`Match on image:  ${byMatch.image}`);
  console.log("");

  if (duplicates.length === 0) {
    console.log(
      "✅ No duplicates found (or phone/email/Main Image fields empty / not matching).",
    );
    return;
  }

  console.log("--- Duplicate rows (max 25) ---");
  for (const row of duplicates.slice(0, 25)) {
    const blob = (row as any).leadData ?? (row as any).payload;
    const idn = extractLeadDuplicateIdentity(blob);
    console.log(
      `  id=${row.id} | count=${row.duplicateCount} | match=${row.duplicateMatchOn.join(",") || "-"} | phone=${idn.phone || "-"} | email=${idn.email || "-"}`,
    );
  }
  if (duplicates.length > 25) {
    console.log(`  … and ${duplicates.length - 25} more`);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("❌", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.close();
    } catch {
      /* ignore */
    }
  });
