import Role from "../models/role.model";
import Permission from "../models/permission.model";
import RolePermission from "../models/rolePermission.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { buildSearchFilter } from "../utils/filterQuery";
import User from "../models/user.model";

export const createRole = async (roleData: {
  name: string;
  permissions: number[];
}) => {
  const { name, permissions } = roleData;

  try {
    const role = await Role.create({ name });

    if (!role || !role.id) {
      throw new Error("Role creation failed, role ID is null.");
    }


    if (permissions && permissions.length > 0) {
      const existingPermissions = await Permission.findAll({
        where: { id: permissions },
      });

      if (existingPermissions.length === 0) {
        throw new Error("No valid permissions found.");
      }

      const rolePermissions = existingPermissions.map((permission: any) => ({
        roleId: role.id,
        permissionId: permission.id,
      }));

      await RolePermission.bulkCreate(rolePermissions);

    }

    return { message: "Role created successfully", role };
  } catch (error: any) {

    if (error.name === "SequelizeValidationError") {
      const errorMessages = error.errors.map((err: any) => err.message);
      return { message: "Validation error", details: errorMessages };
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return {
        message:
          "Foreign key constraint failed. Ensure role and permission IDs are valid.",
        details: error.sqlMessage,
      };
    }

    return {
      message: "Error occurred while creating the role.",
      details: error.message,
    };
  }
};

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}
export const getAllRolesWithPermissions = async ({
  page = 1,
  limit = 10,
  search = "",
}: PaginationParams) => {
  const { offset } = getPagination({ page, limit });

  const whereClause = buildSearchFilter(search, ["name"]);

  const totalItems = await Role.count({ where: whereClause });

  const data = await Role.findAll({
    where: whereClause,
    offset,
    limit,
    include: [
      {
        model: Permission,
        through: { attributes: [] },
      },
    ],
  });

  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    totalPages,
    currentPage: page,
    data,
  };
};

export const updateRolePermissions = async (
  roleId: number,
  permissions: number[]
) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error("Role not found");

  await RolePermission.destroy({ where: { roleId: roleId } });

  const newMappings = permissions.map((pid) => ({
    roleId: roleId,
    permissionId: pid,
  }));
  await RolePermission.bulkCreate(newMappings);

  return await getAllRolesWithPermissions({ page: 1, limit: 10 });
};

export const deleteRole = async (roleId: number) => {
  try {
    const role = await Role.findByPk(roleId);
    if (!role) {
      return { message: "Role not found", success: false };
    }

    await RolePermission.destroy({ where: { roleId: roleId } });

    await Role.destroy({ where: { id: roleId } });

    return { message: "Role deleted successfully", success: true };
  } catch (error: any) {
    return {
      message: "Error occurred while deleting the role.",
      success: false,
      details: error.message,
    };
  }
};


export const getRoleByUserId = async (userId: number) => {
  try {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          include: [
            {
              model: Permission,
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!user) {
      return { message: "User not found", success: false };
    }

    return {
      message: "User role with permissions fetched successfully",
      success: true,
      data: user,
    };
  } catch (error: any) {
    return {
      message: "Error occurred while fetching role by userId.",
      success: false,
      details: error.message,
    };
  }
};