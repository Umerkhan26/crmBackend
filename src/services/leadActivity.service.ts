// src/services/leadActivity.service.ts

import  LeadActivity  from "../models/leadActivity.model";

export const getLeadActivitiesByLeadId = async (leadId: number) => {
  return await LeadActivity.findAll({
    where: { leadId },
    order: [["createdAt", "DESC"]],
  });
};

export const getAllLeadActivities = async () => {
  return LeadActivity.findAll({
    order: [["createdAt", "DESC"]],
  });
};