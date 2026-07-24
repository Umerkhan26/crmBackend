/**
 * Delete idle pending leads for "Fiverr Lead Reference (Hr)"
 * (or another campaign): assignee status pending (or unassigned),
 * zero notes, zero lead activities.
 *
 * DEFAULT = dry-run.
 *
 * Preview (duplicates only — default):
 *   npx ts-node src/scripts/delete-idle-pending-leads.ts "Fiverr Lead Reference (Hr)"
 *
 * Delete duplicates that are pending + no notes + no activity:
 *   npx ts-node src/scripts/delete-idle-pending-leads.ts "Fiverr Lead Reference (Hr)" --confirm
 *
 * Optional limit:
 *   npx ts-node src/scripts/delete-idle-pending-leads.ts "Fiverr Lead Reference (Hr)" --limit=5 --confirm
 *
 * All idle pending (NOT only duplicates — careful):
 *   npx ts-node src/scripts/delete-idle-pending-leads.ts "Fiverr Lead Reference (Hr)" --all-idle
 */

import { Op } from "sequelize";
import db from "../../db";
import "../models/index";
import Lead from "../models/lead.model";
import Note from "../models/note.model";
import LeadActivity from "../models/leadActivity.model";
import {
  annotateLeadsWithDuplicates,
  buildCampaignDuplicateIndexes,
  extractLeadDuplicateIdentity,
} from "../utils/leadDuplicate";

function parseAssignees(raw: unknown): Array<{ userId?: number; status?: string }> {
  if (Array.isArray(raw)) return raw as any[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isPendingIdleAssignees(assigneesRaw: unknown): boolean {
  const assignees = parseAssignees(assigneesRaw);
  if (assignees.length === 0) return true; // unassigned → treat as pending/idle
  return assignees.every((a) => {
    const s = String(a?.status || "pending").toLowerCase().trim();
    return s === "" || s === "pending";
  });
}

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return undefined;
  const parts = hit.split("=");
  return parts.length > 1 ? parts.slice(1).join("=") : undefined;
}

const campaignArg = process.argv
  .slice(2)
  .find((a) => a && !a.startsWith("--"));
const campaignName = (campaignArg || "Fiverr Lead Reference (Hr)").trim();
const limitRaw = argValue("--limit");
const limit = limitRaw != null ? Math.max(1, Number(limitRaw) || 1) : null;
const confirm = process.argv.includes("--confirm");
/** Default: duplicates only. Pass --all-idle to include non-duplicate idle pending. */
const duplicatesOnly = !process.argv.includes("--all-idle");

async function main() {
  await db.authenticate();
  console.log("✅ DB connected\n");
  console.log(`Campaign:         ${campaignName}`);
  console.log(`Duplicates only:  ${duplicatesOnly ? "yes" : "no"}`);
  console.log(`Limit:            ${limit ?? "none (all matching)"}`);
  console.log(`Mode:             ${confirm ? "DELETE (confirm)" : "DRY-RUN (no delete)"}\n`);

  const leads = await Lead.findAll({
    attributes: ["id", "campaignName", "leadData", "assignees", "createdAt"],
    where: { campaignName },
    order: [["id", "ASC"]],
    raw: true,
  });

  console.log(`Total leads in campaign: ${leads.length}`);

  if (!leads.length) {
    console.log("⚠️ No leads found.");
    return;
  }

  const pendingIdle = leads.filter((l: any) => isPendingIdleAssignees(l.assignees));
  console.log(`Pending / unassigned:    ${pendingIdle.length}`);

  const pendingIds = pendingIdle.map((l: any) => Number(l.id));

  // Notes present
  const notesRows =
    pendingIds.length === 0
      ? []
      : ((await Note.findAll({
          attributes: ["notebleId"],
          where: {
            notebleType: "lead",
            notebleId: { [Op.in]: pendingIds },
          },
          raw: true,
        })) as any[]);

  const idsWithNotes = new Set(
    notesRows.map((n) => Number(n.notebleId)).filter((n) => Number.isFinite(n)),
  );

  // Activities present
  const activityRows =
    pendingIds.length === 0
      ? []
      : ((await LeadActivity.findAll({
          attributes: ["entityId"],
          where: {
            entityType: "lead",
            entityId: { [Op.in]: pendingIds },
          },
          raw: true,
        })) as any[]);

  const idsWithActivity = new Set(
    activityRows
      .map((a) => Number(a.entityId))
      .filter((n) => Number.isFinite(n)),
  );

  let candidates = pendingIdle.filter((l: any) => {
    const id = Number(l.id);
    return !idsWithNotes.has(id) && !idsWithActivity.has(id);
  });

  console.log(`No notes + no activity:  ${candidates.length}`);

  if (duplicatesOnly) {
    const indexes = buildCampaignDuplicateIndexes(leads as any[]);
    const annotated = annotateLeadsWithDuplicates(candidates as any[], indexes);
    candidates = annotated.filter((r) => (r as any).isDuplicate) as any[];
    console.log(`Duplicates among those:  ${candidates.length}`);
  }

  candidates = candidates.sort((a: any, b: any) => Number(a.id) - Number(b.id));
  const toDelete =
    limit != null ? candidates.slice(0, limit) : candidates;

  if (!toDelete.length) {
    console.log("\nNo matching leads to delete.");
    return;
  }

  console.log(
    `\n--- Will ${confirm ? "DELETE" : "preview"} ${toDelete.length} of ${candidates.length} matching row(s) ---`,
  );
  for (const row of toDelete.slice(0, 40) as any[]) {
    const idn = extractLeadDuplicateIdentity(row.leadData);
    const assignees = parseAssignees(row.assignees);
    const statuses =
      assignees.length === 0
        ? "unassigned"
        : assignees.map((a) => a.status || "pending").join(",");
    console.log(
      `  id=${row.id} | status=${statuses} | phone=${idn.phone || "-"} | email=${idn.email || "-"} | image=${idn.mainImage ? "yes" : "-"}`,
    );
  }
  if (toDelete.length > 40) {
    console.log(`  … and ${toDelete.length - 40} more`);
  }

  if (!confirm) {
    console.log("\nDry-run only. To delete, add --confirm:");
    const idleFlag = duplicatesOnly ? "" : " --all-idle";
    const limFlag = limit != null ? ` --limit=${limit}` : "";
    console.log(
      `  npx ts-node src/scripts/delete-idle-pending-leads.ts "${campaignName}"${idleFlag}${limFlag} --confirm`,
    );
    return;
  }

  const ids = toDelete
    .map((r: any) => Number(r.id))
    .filter((n) => Number.isFinite(n));

  const deleted = await Lead.destroy({
    where: {
      id: { [Op.in]: ids },
      campaignName,
    },
  });

  console.log(`\n✅ Deleted ${deleted} lead(s).`);
  console.log(`IDs: ${ids.join(", ")}`);
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
