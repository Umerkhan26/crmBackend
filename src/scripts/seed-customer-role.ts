/**
 * Create "customer" role for portal accounts (if missing).
 * Run: npx ts-node src/scripts/seed-customer-role.ts
 */

import db from "../../db";
import Role from "../models/role.model";

const run = async () => {
  await db.authenticate();

  const existing = await Role.findOne({ where: { name: "customer" } });
  if (existing) {
    console.log(`✓ Customer role already exists (id=${existing.id})`);
    console.log(`  Set CUSTOMER_DEFAULT_ROLE_ID=${existing.id} in .env if needed`);
    process.exit(0);
  }

  const role = await Role.create({
    name: "customer",
    description: "Customer Area portal user",
  } as any);

  console.log(`✅ Created customer role (id=${role.id})`);
  console.log(`   Add to .env: CUSTOMER_DEFAULT_ROLE_ID=${role.id}`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
