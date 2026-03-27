import { Request, Response } from "express";
import {
  addUsersToTeam,
  createTeam,
  deleteTeam,
  getAllTeams,
  getTeamById,
  getTeamMembers,
  seedDefaultTeams,
  setTeamMemberStatus,
  updateTeam,
} from "../services/team.service";

export const seedTeamsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await seedDefaultTeams();
    return res.status(200).json({
      success: true,
      message: "Teams seeded successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error seeding teams",
    });
  }
};

export const createTeamController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, code, sortOrder, status } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: "name and code are required" });
    }
    const team = await createTeam({
      name,
      code,
      sortOrder: sortOrder ?? 1,
      status: status || "active",
    } as any);

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating team",
    });
  }
};

export const getAllTeamsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const search = (req.query.search as string) || "";
    const statusRaw = String(req.query.status ?? "").toLowerCase().trim();
    const status =
      statusRaw === "active" || statusRaw === "inactive"
        ? (statusRaw as "active" | "inactive")
        : undefined;
    const result = await getAllTeams({ page, limit, search, status });
    return res.status(200).json({
      success: true,
      message: "Teams retrieved successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching teams",
    });
  }
};

export const getTeamByIdController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }
    const team = await getTeamById(teamId);
    return res.status(200).json({
      success: true,
      message: "Team retrieved successfully",
      data: team,
    });
  } catch (error: any) {
    const status = error.message === "Team not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error fetching team",
    });
  }
};

export const updateTeamController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const { name, code, sortOrder, status } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (status !== undefined) updateData.status = status;

    const team = await updateTeam(teamId, updateData);
    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: team,
    });
  } catch (error: any) {
    const status = error.message === "Team not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error updating team",
    });
  }
};

export const deleteTeamController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }
    const message = await deleteTeam(teamId);
    return res.status(200).json({ success: true, message });
  } catch (error: any) {
    const status = error.message === "Team not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error deleting team",
    });
  }
};

export const getTeamMembersController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const status = ((req.query.status as string) || "active") as any;

    const result = await getTeamMembers({ teamId, page, limit, search, status });
    return res.status(200).json({
      success: true,
      message: "Team members retrieved successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching team members",
    });
  }
};

export const addTeamMembersController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    const { userIds } = req.body;
    if (isNaN(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: "userIds must be an array" });
    }

    const result = await addUsersToTeam(teamId, userIds.map((x: any) => Number(x)));
    return res.status(200).json({
      success: true,
      message: "Members processed successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error adding team members",
    });
  }
};

export const setTeamMemberStatusController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const { status } = req.body;
    if (isNaN(teamId) || isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid teamId or userId" });
    }
    if (status !== "active" && status !== "inactive") {
      return res.status(400).json({ success: false, message: "status must be active|inactive" });
    }

    const message = await setTeamMemberStatus(teamId, userId, status);
    return res.status(200).json({ success: true, message });
  } catch (error: any) {
    const statusCode =
      error.message === "Team member not found" ? 404 : error.message?.includes("already active") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Error updating member status",
    });
  }
};

