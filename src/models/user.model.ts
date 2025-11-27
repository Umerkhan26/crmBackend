import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import { UserAttributes } from "../interfaces/user.interface";
import Role from "./role.model";

interface UserCreationAttributes
  extends Optional<UserAttributes, "id" | "created_at" | "updated_at"> {}

interface UserModel
  extends Model<UserAttributes, UserCreationAttributes>,
    UserAttributes {
  created_at: Date;
  updated_at: Date;
  role?: Role;
}

export const User = db.define<UserModel>(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    firstname: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    lastname: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    coverage: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    linkedin: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    userImage: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    vendor: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    // userrole: {
    //   type: DataTypes.ENUM("admin", "vendor", "client"),
    //   allowNull: true,
    // },
    userrole: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "roles",
        key: "id",
      },
    },
    smtpemail: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    smtppassword: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    smtpincomingserver: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    smtpoutgoingserver: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    smtpport: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    branchname: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    branchslug: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    branchcountry: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    branchaddress: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    brancheader: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    branchnavbar: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    branchnavtext: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    branchnavhover: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    branchlogo: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    branchlogoheight: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    branchlogowidth: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "blocked"),
      allowNull: false,
      defaultValue: "active",
    },
    referred_to: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

User.beforeUpdate((user) => {
  user.updated_at = new Date();
});

User.belongsTo(Role, { foreignKey: "roleId", as: "role" });

export default User;
