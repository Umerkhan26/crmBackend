
  import { DataTypes, Model, Optional } from "sequelize";
  import db from "../../db";

  export interface OrderAttributes {
    id: number;
    agent: string;
    campaign_id: number;
    state: string;
    priority_level: "High" | "Medium" | "Low" | "Gold Agent" | "Onhold";
    age_range: string;
    lead_requested: number;
    fb_link?: string;
    notes?: string;
    area_to_use?: string;
    order_datetime: Date;
    created_by: number;
    assign_to_client?: {
      id: number;
      name: string;
    };
    assign_to_vendor?: {
      id: number;
      name: string;
    };
    is_blocked: boolean; // ✅ New field added
    created_at: Date;
    updated_at: Date;
  }

  export interface OrderCreationAttributes
    extends Optional<
      OrderAttributes,
      "id" | "created_at" | "updated_at" | "is_blocked"
    > {}

  export class Order
    extends Model<OrderAttributes, OrderCreationAttributes>
    implements OrderAttributes
  {
    public id!: number;
    public agent!: string;
    public campaign_id!: number;
    public state!: string;
    public priority_level!: "High" | "Medium" | "Low" | "Gold Agent" | "Onhold";
    public age_range!: string;
    public lead_requested!: number;
    public fb_link?: string;
    public notes?: string;
    public area_to_use?: string;
    public order_datetime!: Date;
    public created_by!: number;
    public assign_to_client?: { id: number; name: string };
    public assign_to_vendor?: { id: number; name: string };
    public is_blocked!: boolean; // ✅ New field
    public created_at!: Date;
    public updated_at!: Date;
  }

  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      agent: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      priority_level: {
        type: DataTypes.ENUM("High", "Medium", "Low", "Gold Agent", "Onhold"),
        allowNull: false,
      },
      age_range: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lead_requested: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fb_link: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      area_to_use: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      order_datetime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assign_to_client: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      assign_to_vendor: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_blocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: db,
      tableName: "orders",
      timestamps: true,
    }
  );

  export default Order;
