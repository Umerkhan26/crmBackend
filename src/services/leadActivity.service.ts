// // src/services/leadActivity.service.ts

// import LeadActivity from "../models/leadActivity.model";
// import User from "../models/user.model"; // adjust path
// import Lead from "../models/lead.model"; // adjust path

// export const getLeadActivitiesByLeadId = async (leadId: number) => {
//   return await LeadActivity.findAll({
//     where: { leadId } as any, // 👈 force-cast to avoid TS error
//     order: [["createdAt", "DESC"]],
//     include: [
//       {
//         model: User,
//         as: "performedByUser", // alias must match association in your model
//         attributes: { exclude: ["password"] }, // exclude sensitive fields
//       },
//       {
//         model: Lead, // You can exclude nothing if you want max info:
//         attributes: { exclude: [] },
//       },
//     ],
//   });
// };

// export const getAllLeadActivities = async () => {
//   return LeadActivity.findAll({
//     order: [["createdAt", "DESC"]],
//   });
// };

// export const updateLeadActivity = async (
//   id: number,
//   data: Partial<LeadActivity>
// ) => {
//   const activity = await LeadActivity.findByPk(id);
//   if (!activity) {
//     throw new Error("Lead activity not found");
//   }
//   await activity.update(data);
//   return activity;
// };

// export const deleteLeadActivity = async (id: number) => {
//   const activity = await LeadActivity.findByPk(id);
//   if (!activity) {
//     throw new Error("Lead activity not found");
//   }
//   await activity.destroy();
//   return { message: "Lead activity deleted successfully" };
// };



// src/services/leadActivity.service.ts

import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";

// 🔹 Get activities for a specific lead (entityType = "lead")
export const getLeadActivitiesByLeadId = async (
  leadId: number,
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  // Use findAndCountAll for pagination
  const data = await LeadActivity.findAndCountAll({
    where: { entityId: leadId, entityType: "lead" }, // ✅ updated
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: User,
        as: "performedByUser", // alias must match association in model setup
        attributes: { exclude: ["password"] },
      },
      {
        model: Lead,
        attributes: { exclude: [] },
      },
    ],
  });

  // Format response with pagination data
  return getPagingData(data, page, limit);
};

// 🔹 You could also add a generic fetcher (works for clientLead too)

// ✅ Get activities by entityId and entityType with pagination
export const getActivitiesByEntity = async (
  entityId: number,
  entityType: "lead" | "clientLead",
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  const data = await LeadActivity.findAndCountAll({
    where: { entityId, entityType },
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: { exclude: ["password"] },
      },
    ],
  });

  return getPagingData(data, page, limit);
};

// ✅ Get all lead activities with pagination
export const getAllLeadActivities = async (
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  const data = await LeadActivity.findAndCountAll({
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return getPagingData(data, page, limit);
};


export const updateLeadActivity = async (
  id: number,
  data: Partial<LeadActivity>
) => {
  const activity = await LeadActivity.findByPk(id);
  if (!activity) {
    throw new Error("Lead activity not found");
  }
  await activity.update(data);
  return activity;
};

export const deleteLeadActivity = async (id: number) => {
  const activity = await LeadActivity.findByPk(id);
  if (!activity) {
    throw new Error("Lead activity not found");
  }
  await activity.destroy();
  return { message: "Lead activity deleted successfully" };
};
