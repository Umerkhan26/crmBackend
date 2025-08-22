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

// 🔹 Get activities for a specific lead (entityType = "lead")
export const getLeadActivitiesByLeadId = async (leadId: number) => {
  return await LeadActivity.findAll({
    where: { entityId: leadId, entityType: "lead" }, // ✅ updated
    order: [["createdAt", "DESC"]],
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
};

// 🔹 You could also add a generic fetcher (works for clientLead too)
export const getActivitiesByEntity = async (
  entityId: number,
  entityType: "lead" | "clientLead"
) => {
  return await LeadActivity.findAll({
    where: { entityId, entityType },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: { exclude: ["password"] },
      },
    ],
  });
};

export const getAllLeadActivities = async () => {
  return LeadActivity.findAll({
    order: [["createdAt", "DESC"]],
  });
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
