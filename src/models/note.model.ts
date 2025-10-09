// import { DataTypes, Model, Optional } from "sequelize";
// import db from "../../db";
// import User from "./user.model";

// interface NoteAttributes {
//   id: number;
//   content: string;
//   type: "comment" | "reminder";
//   notebleId: number;
//   notebleType: "lead" | "client_lead";
//   createdBy: number;
//   reminderType?: string; // <-- NEW optional field
//   reminderDate?: Date;   // ✅ Added this field
// }

// interface NoteCreationAttributes extends Optional<NoteAttributes, "id"> {}

// class Note
//   extends Model<NoteAttributes, NoteCreationAttributes>
//   implements NoteAttributes
// {
//   public id!: number;
//   public content!: string;
//   public type!: "comment" | "reminder";
//   public notebleId!: number;
//   public notebleType!: "lead" | "client_lead";
//   public createdBy!: number;
//   public reminderType?: string; // <-- define as optional

//   public readonly createdAt!: Date;
//   public readonly updatedAt!: Date;
// }

// Note.init(
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     content: {
//       type: DataTypes.TEXT,
//       allowNull: false,
//     },
//     type: {
//       type: DataTypes.ENUM("comment", "reminder"),
//       allowNull: false,
//     },
//     notebleId: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },
//     notebleType: {
//       type: DataTypes.ENUM("lead", "client_lead"),
//       allowNull: false,
//     },
//     createdBy: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//       references: {
//         model: "users",
//         key: "id",
//       },
//     },
//    reminderType: {
//       type: DataTypes.STRING,
//       allowNull: true,
//     },
//     reminderDate: {
//       type: DataTypes.DATE,
//       allowNull: true,
//     },
//   },
//   {
//     sequelize: db,
//     tableName: "notes",
//     timestamps: true,
//     indexes: [
//       {
//         fields: ["notebleId", "notebleType"],
//       },
//     ],
//   }
// );

// export default Note;



import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model";

interface NoteAttributes {
  id: number;
  content: string;
  type: "comment" | "reminder";
  notebleId: number;
  notebleType: "lead" | "client_lead";
  createdBy: number;
  reminderType?: string;
  reminderDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NoteCreationAttributes extends Optional<NoteAttributes, "id"> {}

class Note
  extends Model<NoteAttributes, NoteCreationAttributes>
  implements NoteAttributes
{
  public id!: number;
  public content!: string;
  public type!: "comment" | "reminder";
  public notebleId!: number;
  public notebleType!: "lead" | "client_lead";
  public createdBy!: number;
  public reminderType?: string;
  public reminderDate?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // ✅ Use InstanceType<typeof User> here
  public creator?: InstanceType<typeof User>;
}

Note.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM("comment", "reminder"), allowNull: false },
    notebleId: { type: DataTypes.INTEGER, allowNull: false },
    notebleType: { type: DataTypes.ENUM("lead", "client_lead"), allowNull: false },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    reminderType: { type: DataTypes.STRING, allowNull: true },
    reminderDate: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize: db,
    tableName: "notes",
    timestamps: true,
  }
);

// ✅ Association for creator
Note.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

export default Note;
