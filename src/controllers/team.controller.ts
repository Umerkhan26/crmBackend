import { Request, Response } from "express";
import {
  createTeam,
  deleteTeam,
  getAllTeams,
  getTeamById,
  seedDefaultTeams,
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

