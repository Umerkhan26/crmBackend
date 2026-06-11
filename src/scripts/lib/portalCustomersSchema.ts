import { QueryTypes } from "sequelize";
import db from "../../../db";

export async function columnExists(
  table: string,
  column: string
): Promise<boolean> {
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `,
    { replacements: [table, column] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(
    `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
  `,
    { replacements: [table] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Create portal_customers + customer_accounts.portalCustomerId + backfill from userId. */
export async function ensurePortalCustomersSchema(): Promise<Map<number, number>> {
  const userToPortal = new Map<number, number>();
  const PortalCustomer = (await import("../../models/portalCustomer.model"))
    .default;
  await PortalCustomer.sync();
  console.log("   ✓ portal_customers table ready");

  if (!(await tableExists("customer_accounts"))) {
    console.log("   ⚠ customer_accounts table not found — skip column migration");
    return userToPortal;
  }

  if (!(await columnExists("customer_accounts", "portalCustomerId"))) {
    await db.query(
      "ALTER TABLE customer_accounts ADD COLUMN portalCustomerId INT NULL"
    );
    console.log("   ✓ Added customer_accounts.portalCustomerId");
  } else {
    console.log("   ✓ customer_accounts.portalCustomerId exists");
  }

  const hasLegacyUserId = await columnExists("customer_accounts", "userId");
  if (!hasLegacyUserId) {
    return userToPortal;
  }

  const accounts = (await db.query(
    `
    SELECT ca.id AS accountId, ca.userId, u.email, u.password, u.firstname, u.lastname,
           u.phone, u.brandId, u.last_login, u.status
    FROM customer_accounts ca
    INNER JOIN users u ON u.id = ca.userId
    WHERE ca.portalCustomerId IS NULL
  `,
    { type: QueryTypes.SELECT }
  )) as Array<Record<string, unknown>>;

  if (!accounts.length) {
    const linked = (await db.query(
      `
      SELECT DISTINCT userId, portalCustomerId
      FROM customer_accounts
      WHERE userId IS NOT NULL AND portalCustomerId IS NOT NULL
    `,
      { type: QueryTypes.SELECT }
    )) as Array<{ userId: number; portalCustomerId: number }>;
    for (const row of linked) {
      userToPortal.set(Number(row.userId), Number(row.portalCustomerId));
    }
    console.log("   ✓ customer_accounts already linked to portal_customers");
    return userToPortal;
  }

  for (const row of accounts) {
    const legacyUserId = Number(row.userId);
    let portalCustomerId = userToPortal.get(legacyUserId);

    if (!portalCustomerId) {
      const email = String(row.email || "").trim().toLowerCase();
      if (!email) continue;

      const [existing] = (await db.query(
        `SELECT id FROM portal_customers WHERE email = ? LIMIT 1`,
        { replacements: [email], type: QueryTypes.SELECT }
      )) as Array<{ id: number }>;

      if (existing?.id) {
        portalCustomerId = existing.id;
      } else {
        await db.query(
          `
          INSERT INTO portal_customers
            (email, password, firstname, lastname, phone, brandId, last_login, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
          {
            replacements: [
              email,
              row.password,
              row.firstname,
              row.lastname,
              row.phone,
              row.brandId,
              row.last_login,
              row.status === "suspended" ? "suspended" : "active",
            ],
          }
        );
        const [created] = (await db.query(
          `SELECT id FROM portal_customers WHERE email = ? LIMIT 1`,
          { replacements: [email], type: QueryTypes.SELECT }
        )) as Array<{ id: number }>;
        portalCustomerId = created.id;
      }

      userToPortal.set(legacyUserId, portalCustomerId);
    }

    await db.query(
      `UPDATE customer_accounts SET portalCustomerId = ? WHERE id = ?`,
      { replacements: [portalCustomerId, row.accountId] }
    );
  }

  console.log(
    `   ✓ Backfilled portalCustomerId for ${accounts.length} customer account(s)`
  );

  return userToPortal;
}

/** Drop customer_accounts.userId FK + column (any constraint name, e.g. ibfk_13). */
export async function removeLegacyCustomerAccountUserIdColumn(): Promise<boolean> {
  if (!(await tableExists("customer_accounts"))) return false;
  if (!(await columnExists("customer_accounts", "userId"))) return false;

  const fkRows = (await db.query(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_accounts'
      AND COLUMN_NAME = 'userId'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `,
    { type: QueryTypes.SELECT }
  )) as Array<{ CONSTRAINT_NAME: string }>;

  for (const row of fkRows) {
    const name = row.CONSTRAINT_NAME;
    try {
      await db.query(
        `ALTER TABLE customer_accounts DROP FOREIGN KEY \`${name}\``
      );
      console.log(`   ✓ Dropped FK ${name} on customer_accounts.userId`);
    } catch (err) {
      console.warn(`   ⚠ Could not drop FK ${name}:`, (err as Error).message);
    }
  }

  if (await columnExists("customer_accounts", "portalCustomerId")) {
    try {
      await db.query(`
        ALTER TABLE customer_accounts
        MODIFY COLUMN portalCustomerId INT NOT NULL
      `);
    } catch {
      /* rows may still be null on partial migrate */
    }
  }

  try {
    await db.query(`ALTER TABLE customer_accounts DROP COLUMN userId`);
    console.log("   ✓ Dropped customer_accounts.userId column");
    return true;
  } catch (err) {
    console.warn(
      "   ⚠ Could not drop userId column:",
      (err as Error).message
    );
    return false;
  }
}

async function dropForeignKeysOnColumn(
  table: string,
  column: string
): Promise<void> {
  const fkRows = (await db.query(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `,
    { replacements: [table, column], type: QueryTypes.SELECT }
  )) as Array<{ CONSTRAINT_NAME: string }>;

  for (const row of fkRows) {
    try {
      await db.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
    } catch {
      /* ignore */
    }
  }
}

/** portal_popup_dismissals + portal_activity_events: userId → portalCustomerId */
export async function migratePortalRelatedUserIdColumns(
  userToPortal: Map<number, number>
): Promise<void> {
  const tables = ["portal_popup_dismissals", "portal_activity_events"] as const;

  for (const table of tables) {
    if (!(await tableExists(table))) continue;

    const hasPortal = await columnExists(table, "portalCustomerId");
    const hasUser = await columnExists(table, "userId");

    if (!hasPortal && hasUser) {
      await db.query(
        `ALTER TABLE \`${table}\` ADD COLUMN portalCustomerId INT NULL`
      );
      console.log(`   ✓ Added ${table}.portalCustomerId`);
    }

    if (!(await columnExists(table, "portalCustomerId"))) continue;

    if (userToPortal.size > 0 && hasUser) {
      for (const [legacyUserId, portalCustomerId] of userToPortal.entries()) {
        await db.query(
          `UPDATE \`${table}\` SET portalCustomerId = ? WHERE userId = ? AND portalCustomerId IS NULL`,
          { replacements: [portalCustomerId, legacyUserId] }
        );
      }
    }

    if (hasUser && (await tableExists("users")) && (await tableExists("portal_customers"))) {
      await db.query(`
        UPDATE \`${table}\` t
        INNER JOIN users u ON u.id = t.userId
        INNER JOIN portal_customers pc ON LOWER(pc.email) = LOWER(u.email)
        SET t.portalCustomerId = pc.id
        WHERE t.portalCustomerId IS NULL
      `);
    }

    if (hasUser) {
      await dropForeignKeysOnColumn(table, "userId");
      try {
        await db.query(`ALTER TABLE \`${table}\` DROP COLUMN userId`);
        console.log(`   ✓ Dropped ${table}.userId`);
      } catch (err) {
        console.warn(`   ⚠ Could not drop ${table}.userId:`, (err as Error).message);
      }
    }
  }
}

export async function ensurePortalCustomerIdForeignKey(): Promise<void> {
  if (!(await columnExists("customer_accounts", "portalCustomerId"))) return;

  const existing = (await db.query(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_accounts'
      AND COLUMN_NAME = 'portalCustomerId'
      AND REFERENCED_TABLE_NAME = 'portal_customers'
    LIMIT 1
  `,
    { type: QueryTypes.SELECT }
  )) as Array<{ CONSTRAINT_NAME: string }>;

  if (existing.length) return;

  try {
    await db.query(`
      ALTER TABLE customer_accounts
      ADD CONSTRAINT customer_accounts_portal_customer_fk
      FOREIGN KEY (portalCustomerId) REFERENCES portal_customers(id)
      ON DELETE CASCADE
    `);
    console.log("   ✓ Added FK customer_accounts.portalCustomerId → portal_customers");
  } catch (err) {
    console.warn("   ⚠ Could not add portalCustomerId FK:", (err as Error).message);
  }
}
