/**
 * Delete the first N duplicate leads for a campaign (local cleanup).
 *
 * DEFAULT = dry-run (prints IDs only, does NOT delete).
 *
 * Preview:
 *   npx ts-node src/scripts/delete-first-duplicate-leads.ts "Fiverr Lead Reference"
 *   npx ts-node src/scripts/delete-first-duplicate-leads.ts "Fiverr Lead Reference" --limit=5
 *
 * Actually delete:
 *   npx ts-node src/scripts/delete-first-duplicate-leads.ts "Fiverr Lead Reference" --limit=5 --confirm
 */

import db from "../../db";
import "../models/index";
import Lead from "../models/lead.model";
import {
  annotateLeadsWithDuplicates,
  buildCampaignDuplicateIndexes,
  extractLeadDuplicateIdentity,
} from "../utils/leadDuplicate";

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return undefined;
  const parts = hit.split("=");
  return parts.length > 1 ? parts.slice(1).join("=") : undefined;
}

const campaignArg = process.argv
  .slice(2)
  .find((a) => a && !a.startsWith("--"));
const campaignName = (campaignArg || "Fiverr Lead Reference").trim();
const limit = Math.max(1, Number(argValue("--limit") || 5) || 5);
const confirm = process.argv.includes("--confirm");

async function main() {
  await db.authenticate();
  console.log("✅ DB connected\n");
  console.log(`Campaign: ${campaignName}`);
  console.log(`Limit:    ${limit}`);
  console.log(`Mode:     ${confirm ? "DELETE (confirm)" : "DRY-RUN (no delete)"}\n`);

  const leads = await Lead.findAll({
    attributes: ["id", "campaignName", "leadData", "createdAt"],
    where: { campaignName },
    order: [["id", "ASC"]],
    raw: true,
  });

  if (!leads.length) {
    console.log("⚠️ No leads found for this campaign.");
    return;
  }

  const indexes = buildCampaignDuplicateIndexes(leads as any[]);
  const annotated = annotateLeadsWithDuplicates(leads as any[], indexes);
  const duplicates = annotated
    .filter((r) => r.isDuplicate)
    .sort((a, b) => Number(a.id) - Number(b.id));

  console.log(`Total leads:   ${leads.length}`);
  console.log(`Duplicates:    ${duplicates.length}`);

  const toDelete = duplicates.slice(0, limit);
  if (!toDelete.length) {
    console.log("\nNo duplicates to delete.");
    return;
  }

  console.log(`\n--- Will ${confirm ? "DELETE" : "preview"} ${toDelete.length} row(s) ---`);
  for (const row of toDelete) {
    const idn = extractLeadDuplicateIdentity((row as any).leadData);
    console.log(
      `  id=${row.id} | match=${row.duplicateMatchOn.join(",") || "-"} | phone=${idn.phone || "-"} | email=${idn.email || "-"}`,
    );
  }

  if (!confirm) {
    console.log(
      `\nDry-run only. To delete these ${toDelete.length} leads, re-run with --confirm:`,
    );
    console.log(
      `  npx ts-node src/scripts/delete-first-duplicate-leads.ts "${campaignName}" --limit=${limit} --confirm`,
    );
    return;
  }

  const ids = toDelete.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  const deleted = await Lead.destroy({
    where: {
      id: ids,
      campaignName,
    },
  });

  console.log(`\n✅ Deleted ${deleted} lead(s): ${ids.join(", ")}`);
  console.log("Done.");
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
