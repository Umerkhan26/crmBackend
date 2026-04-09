import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

/** Persisted by cron workers: last rebalance run + per-team shuffle counts (rotation when count > active members). */
export type TeamRotationSchedulerMeta = {
  lastRebalanceRunAt?: string;
  shuffleCountByTeamId?: Record<string, number>;
};

export interface TeamRotationConfigAttributes {
  id: number;
  enabled: boolean;
  rotationOrder: number[]; // array of Team IDs in order A->E
  tenureHours?: number | null; // default rotation window in hours
  timezone?: string | null; // e.g., "Asia/Karachi"
  rebalanceDays?: number | null; // cadence between rebalance runs (cron checks DB; use days)
  assignWindowDefault?: "today" | "yesterday" | "day_before_yesterday" | "custom" | null;
  schedulerMeta?: TeamRotationSchedulerMeta | null;
}

export interface TeamRotationConfigCreationAttributes
  extends Optional<
    TeamRotationConfigAttributes,
    "id" | "enabled" | "tenureHours" | "timezone" | "rebalanceDays" | "assignWindowDefault" | "schedulerMeta"
  > {}

export class TeamRotationConfig
  extends Model<TeamRotationConfigAttributes, TeamRotationConfigCreationAttributes>
  implements TeamRotationConfigAttributes
{
  public id!: number;
  public enabled!: boolean;
  public rotationOrder!: number[];
  public tenureHours?: number | null;
  public timezone?: string | null;
  public rebalanceDays?: number | null;
  public assignWindowDefault?: "today" | "yesterday" | "day_before_yesterday" | "custom" | null;
  public schedulerMeta?: TeamRotationSchedulerMeta | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TeamRotationConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    rotationOrder: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    tenureHours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    rebalanceDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assignWindowDefault: {
      type: DataTypes.ENUM("today", "yesterday", "day_before_yesterday", "custom"),
      allowNull: true,
      defaultValue: "yesterday",
    },
    schedulerMeta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "team_rotation_config",
    timestamps: true,
  },
);

export default TeamRotationConfig;
