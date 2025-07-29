import { DataTypes, Model } from "sequelize";
import db from "../../db";
import User from "./user.model";

export interface ClientAttributes {
  id: number;
  userId: number;
  accountType: string;
  preferences: string;
}

interface ClientModel extends Model<ClientAttributes>, ClientAttributes {}

const Client = db.define<ClientModel>("Client", {
  id: { 
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
    allowNull: false,
    onDelete: 'CASCADE',
  },
  accountType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  preferences: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: "clients",
  timestamps: true,
});

Client.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

export default Client;
