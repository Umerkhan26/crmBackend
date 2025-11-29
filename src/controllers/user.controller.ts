import { Request, Response } from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  loginUser,
  updateUser,
  blockOrUnblockUser,
  getVendorsAndClients
} from "../services/user.service";
import { UserAttributes } from "../interfaces/user.interface";

export const registerUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const userData: Partial<UserAttributes> = req.body;

    // Validation checks
    if (!userData.email || !userData.password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required!",
      });
    }

    // Try creating user
    const user = await createUser(userData);
    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user,
    });
  } catch (error: any) {

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "This email is already registered. Please use another one.",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: error.errors?.[0]?.message || "Invalid input data.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required!",
      });
    }

    const result = await loginUser({ email, password });

    if (!result || !result.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      ...result,
    });
  } catch (error: any) {

    if (error.name === "SequelizeDatabaseError") {
      return res.status(500).json({
        success: false,
        message: "Database error occurred during login.",
      });
    }

    if (error.message?.toLowerCase().includes("invalid credentials")) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong during login.",
      error: error.message,
    });
  }
};




export const getUsers = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const paginatedUsers = await getAllUsers({ page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully!",
      ...paginatedUsers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: (error as Error).message,
    });
  }
};




export const getUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID!" });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    return res.status(200).json({ message: "User retrieved successfully!", user });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
  }
};

export const updateUserController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;
    const updatedData = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const updatedUser = await updateUser(userId, updatedData);

    return res.status(200).json({
      message: "User updated successfully!",
      user: updatedUser
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong during the update.",
      error: error.message
    });
  }
};


export const deleteUserController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;

    const message = await deleteUser(userId);
    return res.status(200).json({ message });
  } catch (error: any) {
    return res.status(500).json({ message: "Something went wrong during deletion.", error: error.message });
  }
};

export const blockOrUnblockUserController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;
    const { action } = req.body;

    if (!["block", "unblock"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'block' or 'unblock'." });
    }

    const message = await blockOrUnblockUser(userId, action as "block" | "unblock");

    return res.status(200).json({ message });
  } catch (error: any) {
    return res.status(500).json({ message: "Something went wrong during block/unblock.", error: error.message });
  }
};

export const getVendorsAndClientsHandler = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const paginatedUsers = await getVendorsAndClients({ page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Vendors and Clients retrieved successfully!",
      ...paginatedUsers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: (error as Error).message,
    });
  }
};
