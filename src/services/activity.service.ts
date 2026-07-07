import ActivityLog, {
  ActivityLogAttributes,
} from "../models/activityLog.model";
import User from "../models/user.model";
import { Model } from "sequelize";
import { Op } from "sequelize";

type ActivityRowInput =
  | Model<ActivityLogAttributes>
  | ActivityLogAttributes
  | Record<string, unknown>;

const toPlainActivityRow = (row: ActivityRowInput): Record<string, unknown> => {
  if (
    row &&
    typeof row === "object" &&
    "toJSON" in row &&
    typeof (row as Model<ActivityLogAttributes>).toJSON === "function"
  ) {
    return (row as Model<ActivityLogAttributes>).toJSON() as unknown as Record<
      string,
      unknown
    >;
  }
  return { ...(row as unknown as Record<string, unknown>) };
};export const formatUserDisplayName = (
  user: {
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
  } | null,
): string | null => {
  if (!user) return null;
  const name = `${user.firstname || ""} ${user.lastname || ""}`.trim();
  return name || user.email || null;
};

export const resolveActivityUserName = async (
  userId: number,
): Promise<string | null> => {
  const user = await User.findByPk(userId, {
    attributes: ["firstname", "lastname", "email"],
  });
  return formatUserDisplayName(user);
};

export const enrichActivityLogRows = async (
  rows: ActivityRowInput[],
): Promise<Record<string, unknown>[]> => {
  const plain = rows.map(toPlainActivityRow);
  const missingUserIds = [
    ...new Set(
      plain
        .filter((r) => !r.userName && r.userId != null)
        .map((r) => Number(r.userId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  if (!missingUserIds.length) return plain;

  const users = await User.findAll({
    where: { id: { [Op.in]: missingUserIds } },
    attributes: ["id", "firstname", "lastname", "email"],
  });

  const nameById = new Map<number, string | null>();
  for (const u of users) {
    const id = u.id;
    if (id != null) {
      nameById.set(id, formatUserDisplayName(u));
    }
  }
  return plain.map((r) => ({
    ...r,
    userName:
      (r.userName as string | null | undefined) ||
      nameById.get(Number(r.userId)) ||
      null,
  }));
};

export const logActivity = async (
  userId: number,
  action: string,
  description: string,
  userName?: string,
) => {
  const resolvedName =
    (userName && String(userName).trim()) ||
    (await resolveActivityUserName(userId));

  const activity = await ActivityLog.create({
    userId,
    userName: resolvedName || null,
    action,
    details: description,
    created_at: new Date(),
  });

  return activity;
};
