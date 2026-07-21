/**
 * List / optionally drop duplicate non-primary indexes on a table.
 * MySQL allows max 64 keys per table; Sequelize alter:true can create duplicates.
 *
 * Usage:
 *   npx ts-node src/scripts/cleanup-duplicate-indexes.ts customer_email_types
 *   npx ts-node src/scripts/cleanup-duplicate-indexes.ts customer_email_types --drop
 */
import db from "../../db";
import "../utils/loadEnv";

const table = process.argv[2] || "customer_email_types";
const shouldDrop = process.argv.includes("--drop");

type IndexRow = {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
};

const run = async () => {
  await db.authenticate();
  const [rows] = (await db.query(`SHOW INDEX FROM \`${table}\``)) as [
    IndexRow[],
    unknown,
  ];

  const byKey = new Map<string, string[]>();
  for (const r of rows) {
    if (r.Key_name === "PRIMARY") continue;
    const cols = byKey.get(r.Key_name) || [];
    cols[r.Seq_in_index - 1] = r.Column_name;
    byKey.set(r.Key_name, cols);
  }

  const signatureToKeys = new Map<string, string[]>();
  for (const [key, cols] of byKey) {
    const sig = cols.filter(Boolean).join(",");
    const list = signatureToKeys.get(sig) || [];
    list.push(key);
    signatureToKeys.set(sig, list);
  }

  console.log(`\nIndexes on ${table} (excluding PRIMARY): ${byKey.size}`);
  for (const [sig, keys] of signatureToKeys) {
    const dup = keys.length > 1 ? `  ← DUPLICATE ×${keys.length}` : "";
    console.log(`  [${sig}] → ${keys.join(", ")}${dup}`);
  }

  if (!shouldDrop) {
    console.log(
      `\nDry run only. To drop extras (keep first of each signature):\n  npx ts-node src/scripts/cleanup-duplicate-indexes.ts ${table} --drop\n`,
    );
    process.exit(0);
  }

  let dropped = 0;
  for (const [, keys] of signatureToKeys) {
    if (keys.length < 2) continue;
    const [, ...extras] = keys;
    for (const key of extras) {
      await db.query(`ALTER TABLE \`${table}\` DROP INDEX \`${key}\``);
      console.log(`  dropped ${key}`);
      dropped += 1;
    }
  }
  console.log(`\n✅ Dropped ${dropped} duplicate index(es).`);
  process.exit(0);
};

run().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
