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

  // Register a new user
  export const registerUser = async (req: Request, res: Response): Promise<any> => {
    try {
      const userData: Partial<UserAttributes> = req.body;

      if (!userData.email || !userData.password) {
        return res.status(400).json({ message: "Email and password are required!" });
      }

      const user = await createUser(userData);
      return res.status(201).json({ message: "User registered successfully!", user });
    } catch (error) {
      console.error("Registration Error:", error);
      return res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
    }
  };

  // Login controller
  export const login = async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required!" });
      }

      const result = await loginUser({ email, password });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Login Error:", error.message);
      return res.status(500).json({ message: "Something went wrong during login." });
    }
  };

  // Get all users

// controllers/user.controller.ts

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
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: (error as Error).message,
    });
  }
};

  


  // Get single user by ID
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
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
    }
  };

  // Update user
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
    console.error("Update Error:", error);
    return res.status(500).json({ 
      message: "Something went wrong during the update.", 
      error: error.message 
    });
  }
};


  // Delete user
  export const deleteUserController = async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = req.params.id;

      const message = await deleteUser(userId);
      return res.status(200).json({ message });
    } catch (error: any) {
      console.error("Delete Error:", error);
      return res.status(500).json({ message: "Something went wrong during deletion.", error: error.message });
    }
  };

  // Block or Unblock a user
  export const blockOrUnblockUserController = async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = req.params.id;
      const { action } = req.body; // "block" or "unblock"

      if (!["block", "unblock"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Use 'block' or 'unblock'." });
      }

      const message = await blockOrUnblockUser(userId, action as "block" | "unblock");

      return res.status(200).json({ message });
    } catch (error: any) {
      console.error("Block/Unblock Error:", error);
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
    console.error("Error fetching vendors and clients:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: (error as Error).message,
    });
  }
};
