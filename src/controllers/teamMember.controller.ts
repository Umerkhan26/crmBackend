import { Request, Response } from "express";
import { addUsersToTeam, getTeamMembers, setTeamMemberStatus } from "../services/teamMember.service";

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

