import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db"; // Ensure your Sequelize instance is imported correctly

// Define the attributes for the Order model
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
  created_at: Date;
  updated_at: Date;
}

// Define attributes required when creating an order (optional fields)
export interface OrderCreationAttributes
  extends Optional<OrderAttributes, "id" | "created_at" | "updated_at"> {}

const initOrderModel = () => {
  return db.define<Model<OrderAttributes, OrderCreationAttributes>>(
    "Order",
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
        type: DataTypes.ENUM("High", "Medium", "Low", "Gold Agent"),
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
        comment: "Contains { id: number, name: string } for the client",
      },
      assign_to_vendor: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Contains { id: number, name: string } for the vendor",
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
      tableName: "orders",
      timestamps: true,
    }
  );
};

const Order = initOrderModel();

export default Order;
