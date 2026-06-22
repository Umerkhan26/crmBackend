/**
 * Ensure GWB, Emrills, Dnova exist as active portal brands with slug/subdomain.
 * Run: npx ts-node src/scripts/seed-portal-brands.ts
 *
 * Tawk.to (optional): set in brand salesFormConfig.portalTheme:
 *   tawkPropertyId, tawkWidgetId, tawkEnabled (false to disable)
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
    salesFormConfig: {
      portalTheme: {
        tawkPropertyId: "6a35b2fc0892181d4aaf0584",
        tawkWidgetId: "1jrgs6bga",
        tawkEnabled: true,
      },
    },
  },
  {
    name: "Emrills",
    slug: "emrills",
    subdomain: "emrills",
    customerPortalUrl: PORTAL_BASE_URL,
    salesFormConfig: {
      portalTheme: {
        tawkPropertyId: "6a35b3bf16fcef1d436fb9d5",
        tawkWidgetId: "1jrgsc9q3",
        tawkEnabled: true,
      },
    },
  },
  {
    name: "Dnova",
    slug: "dnova",
    subdomain: "dnova",
    customerPortalUrl: PORTAL_BASE_URL,
    salesFormConfig: {
      portalTheme: {
        primaryColor: "#141414",
        accentColor: "#BA2222",
        faviconUrl: "/Favicons/dnova.png",
        tawkPropertyId: "6a35b4310f767c1d42224904",
        tawkWidgetId: "1jrgsfojg",
        tawkEnabled: true,
      },
    },
  },
  {
    name: "Look for Leeds",
    slug: "lookforleads",
    subdomain: "lookforleeds",
    customerPortalUrl: PORTAL_BASE_URL,
    salesFormConfig: {
      portalTheme: {
        primaryColor: "#0C27BC",
        accentColor: "#A3CE38",
        faviconUrl: "/Favicons/Looksforleeds.png",
        tawkPropertyId: "6a35a648c398881d47976c4e",
        tawkWidgetId: "1jrgp3381",
        tawkEnabled: true,
      },
    },
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
      const patch: Record<string, unknown> = {
        status: "active",
        slug: spec.slug,
        subdomain: spec.subdomain,
        customerPortalUrl: spec.customerPortalUrl,
      };
      if (spec.salesFormConfig?.portalTheme) {
        const existing = (brand.salesFormConfig || {}) as Record<string, unknown>;
        const existingTheme = (existing.portalTheme || {}) as Record<string, unknown>;
        patch.salesFormConfig = {
          ...existing,
          portalTheme: {
            ...existingTheme,
            ...spec.salesFormConfig.portalTheme,
          },
        };
      }
      await brand.update(patch);
      console.log(`   ✓ Updated brand: ${spec.name} (id=${brand.id})`);
    } else {
      brand = await Brand.create({
        name: spec.name,
        status: "active",
        slug: spec.slug,
        subdomain: spec.subdomain,
        customerPortalUrl: spec.customerPortalUrl,
        salesFormConfig: spec.salesFormConfig ?? { productTypes: [] },
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
