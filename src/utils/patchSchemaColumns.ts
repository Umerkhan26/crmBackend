import type { Sequelize } from "sequelize";

const tryQuery = async (sequelize: Sequelize, label: string, sql: string) => {
  try {
    await sequelize.query(sql);
    console.log(`✅ ${label}`);
  } catch (e: any) {
    const code = e?.original?.code || e?.parent?.code;
    const msg = String(e?.message || e || "");
    if (
      code === "ER_DUP_FIELDNAME" ||
      code === 1060 ||
      /duplicate column/i.test(msg) ||
      /already exists/i.test(msg)
    ) {
      console.log(`⏭️  ${label} (already present)`);
      return;
    }
    throw e;
  }
};

/**
 * Columns defined on Sequelize models but sometimes missing on older databases.
 */
export const patchMissingSchemaColumns = async (sequelize: Sequelize) => {
  const dialect = sequelize.getDialect();

  if (dialect === "postgres") {
    await tryQuery(
      sequelize,
      "team_rotation_config.rebalanceHours",
      'ALTER TABLE "team_rotation_config" ADD COLUMN IF NOT EXISTS "rebalanceHours" INTEGER;',
    );
    await tryQuery(
      sequelize,
      "team_rotation_config.assignWindowDefault",
      `ALTER TABLE "team_rotation_config" ADD COLUMN IF NOT EXISTS "assignWindowDefault" VARCHAR(32) DEFAULT 'yesterday';`,
    );
    await tryQuery(
      sequelize,
      "lead_locks.lockUntil",
      'ALTER TABLE "lead_locks" ADD COLUMN IF NOT EXISTS "lockUntil" TIMESTAMP WITH TIME ZONE;',
    );
    return;
  }

  if (dialect === "sqlite") {
    console.warn(
      "⚠️ sqlite: add rebalanceHours / assignWindowDefault / lockUntil manually if you see unknown column errors.",
    );
    return;
  }

  await tryQuery(
    sequelize,
    "team_rotation_config.rebalanceHours",
    "ALTER TABLE `team_rotation_config` ADD COLUMN `rebalanceHours` INT NULL",
  );
  await tryQuery(
    sequelize,
    "team_rotation_config.assignWindowDefault",
    "ALTER TABLE `team_rotation_config` ADD COLUMN `assignWindowDefault` ENUM('today','yesterday','day_before_yesterday','custom') NULL DEFAULT 'yesterday'",
  );
  await tryQuery(
    sequelize,
    "lead_locks.lockUntil",
    "ALTER TABLE `lead_locks` ADD COLUMN `lockUntil` DATETIME NULL",
  );
};
