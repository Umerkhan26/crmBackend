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
import { emailQueue } from "../queue/emailQueue"; // or wherever your queue is defined
import { buildSearchFilter } from "../utils/filterQuery";
import Permission from "../models/permission.model";
import ActivityLog from "../models/activityLog.model";
import Campaign from "../models/campaign.model";
import { Op } from "sequelize";

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

  // Hash password
  const salt = await bcrypt.genSalt(10);
  userData.password = await bcrypt.hash(password, salt);

  const newUserData: UserAttributes = {
    ...userData,
    roleId,
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

  // Log activity + notification
  await logActivity(user.id, "Registration", "User registered successfully");
  await sendNotification(
    user.id,
    "Welcome! Your account has been successfully created."
  );

  // ✅ Fetch user with role to check email permission
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
  console.log("➡️ Role used for permission check:", roleName);

  const canSendEmail = await checkEmailPermission("user:create", roleName);
  console.log("➡️ Checking if user can receive email...");
  console.log("➡️ Email permission result:", canSendEmail);

  if (canSendEmail) {
    const smtpConfig = await getSmtpConfig(user.id);

    const { subject, body } = await getCompiledTemplate("user:create", {
      firstname: userWithRole?.firstname || "",
      lastname: userWithRole?.lastname || "",
      email: userWithRole?.email || "",
    });

    console.log("📧 Preparing to send email:");
    console.log("Service:", "user:create");
    console.log("Recipient:", userWithRole?.email);
    console.log("Subject:", subject);
    console.log("Body Preview:", body.substring(0, 200));
    console.log("SMTP Config:", smtpConfig);

    await emailQueue.add("user:create", {
      to: userWithRole?.email,
      subject,
      body,
      smtpConfig,
      serviceName: "user:create",
    });

    console.log("✅ Email queued successfully for", userWithRole?.email);
  }

  // Fetch full user with permissions if needed
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
    { expiresIn: "1h" }
  );

  if (user.id) {
    await logActivity(user.id, "Login", "User logged in successfully");
    await sendNotification(user.id, "You have successfully logged in!");
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
      role: user.role, // includes permissions
    },
    token,
  };
};


export const getUserById = async (userId: number): Promise<any> => {
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

  return user;
};

export const getAllUsers = async ({
  page = 1,
  limit = 10,
  search = "",
}: PaginationParams & { search?: string }): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const whereClause = buildSearchFilter(search, [
    "firstname",
    "lastname",
    "email",
  ]);

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

export const updateUser = async (
  userId: string,
  updatedData: Partial<UserAttributes>
): Promise<any> => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found!");
    }

    // ✅ Hash password if being updated
    if (updatedData.password) {
      const salt = await bcrypt.genSalt(10);
      updatedData.password = await bcrypt.hash(updatedData.password, salt);
    }

    // ✅ Only update image if explicitly provided
    if (updatedData.userImage === undefined) {
      delete updatedData.userImage; // not sent → leave old one
    } else if (updatedData.userImage === null) {
      updatedData.userImage = null; // explicitly sent null → clear
    }

    await user.update(updatedData);
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
