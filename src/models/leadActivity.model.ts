// import { DataTypes, Model, Optional } from "sequelize";
// import db from "../../db";

// export interface LeadActivityAttributes {
//   id: number;
//   entityId: number; // ID of the lead or clientLead
//   entityType: "lead" | "clientLead"; // To differentiate
//   action: string; // e.g., "status_updated", "email_sent"
//   details?: string; // Optional details like status changed, email subject, etc.
//   performedBy: number; // User ID who did the action
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// export interface LeadActivityCreationAttributes
//   extends Optional<
//     LeadActivityAttributes,
//     "id" | "details" | "createdAt" | "updatedAt"
//   > { }

// class LeadActivity
//   extends Model<LeadActivityAttributes, LeadActivityCreationAttributes>
//   implements LeadActivityAttributes {
//   public id!: number;
//   public entityId!: number;
//   public entityType!: "lead" | "clientLead";
//   public action!: string;
//   public details?: string;
//   public performedBy!: number;
//   public readonly createdAt!: Date;
//   public readonly updatedAt!: Date;
// }

// LeadActivity.init(
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     entityId: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },
//     entityType: {
//       type: DataTypes.ENUM("lead", "clientLead"),
//       allowNull: false,
//     },
//     action: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     details: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//     performedBy: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },
//   },
//   {
//     sequelize: db,
//     tableName: "lead_activities",
//     timestamps: true,
//   }
// );

// export default LeadActivity;

import { DataTypes, Model, Optional, Association } from "sequelize";
import db from "../../db";

import User from "./user.model";
import Lead from "./lead.model";

export interface LeadActivityAttributes {
  id: number;
  entityId: number;
  entityType: "lead" | "clientLead";
  action: string;
  details?: string;
  performedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeadActivityCreationAttributes
  extends Optional<
    LeadActivityAttributes,
    "id" | "details" | "createdAt" | "updatedAt"
  > {}

class LeadActivity
  extends Model<LeadActivityAttributes, LeadActivityCreationAttributes>
  implements LeadActivityAttributes
{
  public id!: number;
  public entityId!: number;
  public entityType!: "lead" | "clientLead";
  public action!: string;
  public details?: string;
  public performedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // ✅ Use typeof User / Lead for association types
  public performedByUser?: InstanceType<typeof User>;
  public Lead?: InstanceType<typeof Lead>;

  public static associations: {
    performedByUser: Association<LeadActivity, InstanceType<typeof User>>;
    Lead: Association<LeadActivity, InstanceType<typeof Lead>>;
  };
}

LeadActivity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.ENUM("lead", "clientLead"),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "lead_activities",
    timestamps: true,
  }
);

// ✅ Define associations
// LeadActivity.belongsTo(User, {
//   foreignKey: "performedBy",
//   as: "performedByUser",
// });

LeadActivity.belongsTo(Lead, {
  foreignKey: "entityId",
  as: "Lead",
});

export default LeadActivity;
