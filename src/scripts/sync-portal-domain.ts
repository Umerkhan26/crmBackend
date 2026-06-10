/**
 * Set customer portal URL to https://customerarea.live for all active brands.
 * Run: npm run sync:portal-domain
 */
import db from "../../db";
import Brand from "../models/brand.model";

const PORTAL_BASE_URL =
  process.env.CUSTOMER_PORTAL_BASE_URL?.trim() || "https://customerarea.live";

const run = async () => {
  await db.authenticate();
  const brands = await Brand.findAll({ where: { status: "active" } });

  let updated = 0;
  for (const brand of brands) {
    const nextUrl = PORTAL_BASE_URL;

    if (brand.customerPortalUrl !== nextUrl) {
      await brand.update({ customerPortalUrl: nextUrl });
      console.log(`   ✓ ${brand.name} (id=${brand.id}) → ${nextUrl}`);
      updated += 1;
    } else {
      console.log(`   · ${brand.name} already ${nextUrl}`);
    }
  }

  console.log(`\n✅ Done. Updated ${updated} brand(s). Base: ${PORTAL_BASE_URL}`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
