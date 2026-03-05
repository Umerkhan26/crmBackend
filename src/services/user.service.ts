import User from "../models/user.model";
import bcrypt from "bcrypt";
import { UserAttributes } from "../interfaces/user.interface";
import jwt from "jsonwebtoken";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import Role from "../models/role.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { checkEmailPermission } from "./email.service";
import { getCompiledTemplate } from "./template.service";
import { emailQueue } from "../queue/emailQueue";
import { buildSearchFilter } from "../utils/filterQuery";
import Permission from "../models/permission.model";
import ActivityLog from "../models/activityLog.model";
import Campaign from "../models/campaign.model";
import { Op, fn, col } from "sequelize";
import { userRegistrationTemplate } from "../Templetes/userRegistrationTemplate";
import { sendEmail } from "../utils/email";

interface PaginationParams {
  page?: number;
  limit?: number;
}



export const createUser = async (
  userData: Partial<UserAttributes>
): Promise<any> => {
  const { email, password, roleId } = userData;

  if (!email || !password || !roleId) {
    throw new Error("Email, password, and user role are required!");
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new Error("Email already in use!");
  }

  const salt = await bcrypt.genSalt(10);
  userData.password = await bcrypt.hash(password, salt);

  const newUserData: UserAttributes = {
    ...userData,
    roleId,
    brandId: userData.brandId ?? undefined, // optional: include for new users, old data has null
    status: "active",
    token: userData.token || "",
    created_at: new Date(),
    updated_at: new Date(),
    userImage: userData.userImage || null,
  };

  const user = await User.create(newUserData);

  if (!user.id) {
    throw new Error("User ID not found after creation");
  }

  await logActivity(
    user.id,
    "Registration",
    "User registered successfully",
    `${user.firstname || ""} ${user.lastname || ""}`
  );

  await sendNotification(
    user.id,
    "Welcome! Your account has been successfully created.",
    `${user.firstname || ""} ${user.lastname || ""}`
  );

  const userWithRole = await User.findOne({
    where: { id: user.id },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
      },
    ],
  });

  const roleName = userWithRole?.role?.name || "client";

  const canSendEmail = await checkEmailPermission("user:create", roleName);

  if (canSendEmail) {
    const userSmtp = {
      host: userWithRole?.smtpoutgoingserver,
      port: userWithRole?.smtpport ? Number(userWithRole.smtpport) : undefined,
      user: userWithRole?.smtpemail,
      pass: userWithRole?.smtppassword,
    };

    const smtpConfig =
      userSmtp.host && userSmtp.port && userSmtp.user && userSmtp.pass
        ? {
          host: userSmtp.host,
          port: userSmtp.port,
          user: userSmtp.user,
          pass: userSmtp.pass,
        }
        : {
          host: process.env.DEFAULT_SMTP_HOST!,
          port: Number(process.env.DEFAULT_SMTP_PORT!),
          user: process.env.DEFAULT_SMTP_EMAIL!,
          pass: process.env.DEFAULT_SMTP_PASSWORD!,
        };

    const { subject, html } = userRegistrationTemplate({
      firstname: userWithRole?.firstname || "",
      lastname: userWithRole?.lastname || "",
      email: userWithRole?.email || "",
    });


    try {
      await sendEmail({
        smtp: smtpConfig,
        to: userWithRole?.email!,
        subject,
        body: html,
      });
    } catch (err) {
    }
  }

  const userFull = await User.findOne({
    where: { id: user.id },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
        include: [
          {
            model: Permission,
            attributes: ["id", "name", "resourceType", "resourceId"],
          },
        ],
      },
    ],
  });

  return userFull;
};



export const loginUser = async (userData: {
  email: string;
  password: string;
}): Promise<any> => {
  const { email, password } = userData;

  if (!email || !password) {
    throw new Error("Email and password are required!");
  }

  const user = await User.findOne({
    where: { email },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
        include: [
          {
            model: Permission,
            attributes: ["id", "name", "resourceType", "resourceId"],
          },
        ],
      },
    ],
  });

  if (!user) {
    throw new Error("User not found!");
  }

  if (!user.password) {
    throw new Error("User password is missing!");
  }

  if (user.status === "blocked") {
    throw new Error("Your account has been blocked. Please contact support.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials!");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, userrole: user.userrole },
    process.env.JWT_SECRET as string,
    { expiresIn: "24h" }
  );

  if (user.id) {
    const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim();

    await logActivity(
      user.id,
      "Login",
      "User logged in successfully",
      fullName
    );

    await sendNotification(
      user.id,
      "You have successfully logged in!",
      fullName
    );
  } else {
    throw new Error("User ID is missing!");
  }

  return {
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      userrole: user.userrole,
      status: user.status,
      last_login: user.last_login,
      userImage: user.userImage || null,
      role: user.role,
    },
    token,
  };
};

export const getUserById = async (
  userId: number,
  requesterUserId?: number
): Promise<any> => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
        include: [
          {
            model: Permission,
            attributes: ["id", "name", "resourceType", "resourceId"],
          },
        ],
      },
    ],
  });

  if (!user) {
    throw new Error("User not found!");
  }

  // Check if requester is a manager and if they can access this user
  if (requesterUserId) {
    const { isUserManager, getManagerBrandUserIds, canUserAccessBrand } = await import("../utils/brandUtils");
    const isManager = await isUserManager(requesterUserId);
    
    if (isManager) {
      // Manager can only see users under their brands
      const brandUserIds = await getManagerBrandUserIds(requesterUserId);
      if (!brandUserIds.includes(userId)) {
        throw new Error("Access denied: You can only view users under your managed brands");
      }
    }
  }

  return user;
};

export const getAllUsers = async ({
  page = 1,
  limit = 10,
  search = "",
  requesterUserId,
}: PaginationParams & { search?: string; requesterUserId?: number }): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const whereClause = buildSearchFilter(search, [
    "firstname",
    "lastname",
    "email",
  ]);

  // Check if requester is a manager and filter users accordingly
  let brandUserIds: number[] | null = null;
  if (requesterUserId) {
    const { isUserManager, getManagerBrandUserIds } = await import("../utils/brandUtils");
    const isManager = await isUserManager(requesterUserId);
    if (isManager) {
      brandUserIds = await getManagerBrandUserIds(requesterUserId);
      // If manager has no brand users, return empty result
      if (brandUserIds.length === 0) {
        return getPagingData({ count: 0, rows: [] }, page, pageLimit);
      }
    }
  }

  // Add brand filtering if requester is a manager
  const finalWhereClause: any = { ...whereClause };
  if (brandUserIds !== null && brandUserIds.length > 0) {
    finalWhereClause.id = {
      [Op.in]: brandUserIds,
    };
  }

  const data = await User.findAndCountAll({
    where: finalWhereClause,
    offset,
    limit: pageLimit,
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
      },
    ],
  });

  return getPagingData(data, page, pageLimit);
};

export const updateUser = async (
  userId: string,
  updatedData: Partial<UserAttributes>
): Promise<any> => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found!");
    }

    if (updatedData.password) {
      const salt = await bcrypt.genSalt(10);
      updatedData.password = await bcrypt.hash(updatedData.password, salt);
    }

    if (updatedData.userImage === undefined) {
      delete updatedData.userImage;
    } else if (updatedData.userImage === null || updatedData.userImage === "") {
      updatedData.userImage = null;
    }

    await user.update(updatedData);

    const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();

    await logActivity(
      user.id!,
      "Profile Update",
      "User updated profile information",
      fullName
    );

    await sendNotification(
      user.id!,
      "Your profile has been successfully updated.",
      fullName
    );

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const deleteUser = async (userId: string): Promise<string> => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found!");
    }

    const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();

    await logActivity(
      user.id!,
      "Account Deletion",
      "User account has been deleted",
      fullName
    );

    await sendNotification(
      user.id!,
      "Your account has been deleted by the administrator.",
      fullName
    );

    await user.destroy();

    return "User deleted successfully!";
  } catch (error: any) {
    throw new Error(error.message);
  }
};


export const blockOrUnblockUser = async (
  userId: string,
  action: "block" | "unblock"
): Promise<string> => {
  try {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found!");
    }

    const userIdNum = user.id;
    if (userIdNum === undefined) {
      throw new Error("User ID is missing.");
    }

    if (action === "block") {
      if (user.status === "blocked") {
        return "User is already blocked.";
      }
      await user.update({ status: "blocked" });
      await logActivity(
        userIdNum,
        "Account Blocked",
        "User account was blocked."
      );
      await sendNotification(
        userIdNum,
        "Your account has been blocked. Please contact support."
      );
      return "User has been blocked successfully.";
    } else if (action === "unblock") {
      if (user.status === "active") {
        return "User is already active.";
      }
      await user.update({ status: "active" });
      await logActivity(
        userIdNum,
        "Account Unblocked",
        "User account was unblocked."
      );
      await sendNotification(
        userIdNum,
        "Your account has been unblocked. You can now log in."
      );
      return "User has been unblocked successfully.";
    } else {
      throw new Error("Invalid action. Use 'block' or 'unblock'.");
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getVendorsAndClients = async ({
  page = 1,
  limit = 10,
  search = "",
}: PaginationParams & { search?: string }): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const whereClause = {
    ...buildSearchFilter(search, ["firstname", "lastname", "email"]),
    userrole: { [Op.in]: ["vendor", "client"] },
  };

  const data = await User.findAndCountAll({
    where: whereClause,
    offset,
    limit: pageLimit,
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "description"],
      },
    ],
  });

  return getPagingData(data, page, pageLimit);
};


export const getUserSummaryService = async () => {
  // 1️⃣ TOTAL USERS
  const totalUsers = await User.count();

  // 2️⃣ USERS BY STATUS
  const activeUsers = await User.count({
    where: { status: "active" },
  });

  const blockedUsers = await User.count({
    where: { status: "blocked" },
  });

  // 3️⃣ USERS BY ROLE
  const usersByRole = await User.findAll({
    attributes: [
      "roleId",
      [fn("COUNT", col("User.id")), "count"],
    ],
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name"],
      },
    ],
    group: ["roleId", "role.id"],
  });

  const roles = usersByRole.map((item: any) => ({
    roleId: item.roleId,
    roleName: item.role?.name || "Unknown",
    count: Number(item.getDataValue("count")),
  }));

  return {
    totalUsers,
    status: {
      active: activeUsers,
      blocked: blockedUsers,
    },
    roles,
  };
};