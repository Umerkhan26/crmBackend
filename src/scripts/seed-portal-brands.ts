/**
 * Ensure GWB, Emrills, Dnova exist as active portal brands with slug/subdomain.
 * Run: npx ts-node src/scripts/seed-portal-brands.ts
 */
import db from "../../db";
import Brand from "../models/brand.model";

const PORTAL_BASE_URL = "https://customerarea.live";

const PORTAL_BRANDS = [
  {
    name: "GWB",
    slug: "gwb",
    subdomain: "globalwebbuilders",
    customerPortalUrl: PORTAL_BASE_URL,
  },
  {
    name: "Emrills",
    slug: "emrills",
    subdomain: "emrills",
    customerPortalUrl: PORTAL_BASE_URL,
  },
  {
    name: "Dnova",
    slug: "dnova",
    subdomain: "dnova",
    customerPortalUrl: PORTAL_BASE_URL,
  },
];

const run = async () => {
  await db.authenticate();
  console.log("Seeding portal brands...\n");

  for (const spec of PORTAL_BRANDS) {
    let brand = await Brand.findOne({ where: { name: spec.name } });
    if (!brand) {
      brand = await Brand.findOne({ where: { slug: spec.slug } });
    }
    if (brand) {
      await brand.update({
        status: "active",
        slug: spec.slug,
        subdomain: spec.subdomain,
        customerPortalUrl: spec.customerPortalUrl,
      });
      console.log(`   ✓ Updated brand: ${spec.name} (id=${brand.id})`);
    } else {
      brand = await Brand.create({
        name: spec.name,
        status: "active",
        slug: spec.slug,
        subdomain: spec.subdomain,
        customerPortalUrl: spec.customerPortalUrl,
        salesFormConfig: { productTypes: [] },
      });
      console.log(`   ✓ Created brand: ${spec.name} (id=${brand.id})`);
    }
  }

  const active = await Brand.findAll({ where: { status: "active" } });
  console.log(`\n✅ Done. ${active.length} active brand(s) in database.`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
