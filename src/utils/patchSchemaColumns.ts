import type { Sequelize } from "sequelize";

/** One-time: copy legacy rebalanceHours into rebalanceDays (days) when rebalanceDays is null. */
const tryBackfillRebalanceDaysFromHoursPostgres = async (sequelize: Sequelize) => {
  try {
    await sequelize.query(`
      UPDATE "team_rotation_config"
      SET "rebalanceDays" = GREATEST(1, CEIL(COALESCE("rebalanceHours", 24)::numeric / 24.0))
      WHERE "rebalanceDays" IS NULL
    `);
    console.log("✅ team_rotation_config.rebalanceDays backfill (from rebalanceHours when present)");
  } catch (e: any) {
    console.log("⏭️  team_rotation_config.rebalanceDays backfill skipped:", e?.message || e);
  }
};

const tryBackfillRebalanceDaysFromHoursMysql = async (sequelize: Sequelize) => {
  try {
    await sequelize.query(`
      UPDATE team_rotation_config
      SET rebalanceDays = GREATEST(1, FLOOR((COALESCE(rebalanceHours, 24) + 23) / 24))
      WHERE rebalanceDays IS NULL
    `);
    console.log("✅ team_rotation_config.rebalanceDays backfill (from rebalanceHours when present)");
  } catch (e: any) {
    console.log("⏭️  team_rotation_config.rebalanceDays backfill skipped:", e?.message || e);
  }
};

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
      "team_rotation_config.rebalanceDays",
      'ALTER TABLE "team_rotation_config" ADD COLUMN IF NOT EXISTS "rebalanceDays" INTEGER;',
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
    await tryQuery(
      sequelize,
      "lead_assignment_state.seenUserIds",
      'ALTER TABLE "lead_assignment_state" ADD COLUMN IF NOT EXISTS "seenUserIds" JSONB DEFAULT \'[]\'::jsonb;',
    );
    await tryQuery(
      sequelize,
      "lead_assignment_state.cycleStep",
      'ALTER TABLE "lead_assignment_state" ADD COLUMN IF NOT EXISTS "cycleStep" INTEGER NOT NULL DEFAULT 0;',
    );
    await tryBackfillRebalanceDaysFromHoursPostgres(sequelize);
    return;
  }

  if (dialect === "sqlite") {
    console.warn(
      "⚠️ sqlite: add rebalanceDays / rebalanceHours / assignWindowDefault / lockUntil / seenUserIds / cycleStep manually if you see unknown column errors.",
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
    "team_rotation_config.rebalanceDays",
    "ALTER TABLE `team_rotation_config` ADD COLUMN `rebalanceDays` INT NULL",
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
  await tryQuery(
    sequelize,
    "lead_assignment_state.seenUserIds",
    "ALTER TABLE `lead_assignment_state` ADD COLUMN `seenUserIds` JSON NULL",
  );
  await tryQuery(
    sequelize,
    "lead_assignment_state.cycleStep",
    "ALTER TABLE `lead_assignment_state` ADD COLUMN `cycleStep` INT NOT NULL DEFAULT 0",
  );
  await tryBackfillRebalanceDaysFromHoursMysql(sequelize);
};
