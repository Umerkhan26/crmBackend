// src/services/leadActivity.service.ts

import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model"; // adjust path
import Lead from "../models/lead.model"; // adjust path

export const getLeadActivitiesByLeadId = async (leadId: number) => {
  return await LeadActivity.findAll({
    where: { leadId },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        as: "performedByUser", // alias must match association in your model
        attributes: { exclude: ["password"] }, // exclude sensitive fields
      },
      {
        model: Lead, // You can exclude nothing if you want max info:
        attributes: { exclude: [] },
      },
    ],
  });
};

export const getAllLeadActivities = async () => {
  return LeadActivity.findAll({
    order: [["createdAt", "DESC"]],
  });
};
