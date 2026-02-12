

import Note from "../models/note.model";
import User from "../models/user.model";
import { logLeadActivity } from "../utils/logLeadActivity";
import { Op } from "sequelize";
import Campaign from "../models/campaign.model";

interface AddNoteParams {
  content: string;
  type: "comment" | "reminder";
  notebleId: number;
  notebleType: "lead" | "client_lead";
  userId: number;
}

interface AddReminderParams {
  content: string;
  reminderDate?: Date;
  reminderType?: string;
  notebleId: number;
  notebleType: "lead" | "client_lead";
  userId: number;
}

interface GetRemindersParams {
  notebleId: number;
  notebleType: "lead" | "client_lead";
}

/**
 * Helper function to extract name/title from leadData based on campaign fields
 * Looks for common name-related fields like first_name, last_name, business_name, title, name, etc.
 */
const extractLeadName = async (
  campaignName: string | null,
  leadData: any
): Promise<string | null> => {
  if (!campaignName || !leadData) {
    return null;
  }

  try {
    // Parse leadData if it's a string
    const parsedLeadData = typeof leadData === "string" 
      ? JSON.parse(leadData) 
      : leadData;

    // Fetch campaign to get its field structure
    const campaign = await Campaign.findOne({
      where: { campaignName },
    });

    if (!campaign || !campaign.fields) {
      // Fallback to common field names if campaign not found
      return (
        parsedLeadData?.business_name ||
        parsedLeadData?.businessName ||
        parsedLeadData?.name ||
        parsedLeadData?.title ||
        (parsedLeadData?.first_name || parsedLeadData?.firstname
          ? `${parsedLeadData.first_name || parsedLeadData.firstname || ""} ${
              parsedLeadData.last_name || parsedLeadData.lastname || ""
            }`.trim() || null
          : null) ||
        null
      );
    }

    const campaignFields = Array.isArray(campaign.fields) 
      ? campaign.fields 
      : typeof campaign.fields === "string"
      ? JSON.parse(campaign.fields)
      : [];

    // Priority order for name fields
    const nameFieldPatterns = [
      // Business/Company names
      { patterns: ["business_name", "businessName", "company_name", "companyName", "organization"], priority: 1 },
      // Title
      { patterns: ["title", "job_title", "position"], priority: 2 },
      // Full name fields
      { patterns: ["name", "full_name", "fullName", "contact_name", "contactName"], priority: 3 },
      // First + Last name combination
      { patterns: ["first_name", "firstname", "firstName"], priority: 4, requiresLast: true },
    ];

    // Check each priority level
    for (const nameFieldGroup of nameFieldPatterns) {
      for (const pattern of nameFieldGroup.patterns) {
        // Check if this field exists in campaign fields (by col_slug or col_name)
        const fieldExists = campaignFields.some(
          (field: any) =>
            field.col_slug?.toLowerCase() === pattern.toLowerCase() ||
            field.col_name?.toLowerCase() === pattern.toLowerCase() ||
            field.col_slug?.toLowerCase().replace(/[^a-z0-9]/g, "") === pattern.toLowerCase().replace(/[^a-z0-9]/g, "") ||
            field.col_name?.toLowerCase().replace(/[^a-z0-9]/g, "") === pattern.toLowerCase().replace(/[^a-z0-9]/g, "")
        );

        if (fieldExists) {
          // Try to find the value in leadData using various key formats
          const possibleKeys = [
            pattern,
            pattern.toLowerCase(),
            pattern.toUpperCase(),
            pattern.replace(/_/g, ""),
            pattern.replace(/_/g, "-"),
            // Camel case variations
            pattern.split("_").map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(""),
          ];

          for (const key of possibleKeys) {
            if (parsedLeadData[key] !== undefined && parsedLeadData[key] !== null && parsedLeadData[key] !== "") {
              // If it requires last name, combine first and last
              if (nameFieldGroup.requiresLast) {
                const firstName = parsedLeadData[key];
                const lastNameKeys = ["last_name", "lastname", "lastName"];
                let lastName = "";
                for (const lnKey of lastNameKeys) {
                  if (parsedLeadData[lnKey]) {
                    lastName = parsedLeadData[lnKey];
                    break;
                  }
                }
                const fullName = `${firstName} ${lastName}`.trim();
                return fullName || null;
              }
              return String(parsedLeadData[key]);
            }
          }
        }
      }
    }

    // Fallback: try to find any value in leadData that matches campaign field slugs
    for (const field of campaignFields) {
      const slug = field.col_slug || field.col_name;
      if (slug && parsedLeadData[slug] !== undefined && parsedLeadData[slug] !== null && parsedLeadData[slug] !== "") {
        // Check if this looks like a name field
        const slugLower = slug.toLowerCase();
        if (
          slugLower.includes("name") ||
          slugLower.includes("title") ||
          slugLower.includes("business") ||
          slugLower.includes("company") ||
          slugLower.includes("contact")
        ) {
          return String(parsedLeadData[slug]);
        }
      }
    }

    // Final fallback to common field names
    return (
      parsedLeadData?.business_name ||
      parsedLeadData?.businessName ||
      parsedLeadData?.name ||
      parsedLeadData?.title ||
      (parsedLeadData?.first_name || parsedLeadData?.firstname
        ? `${parsedLeadData.first_name || parsedLeadData.firstname || ""} ${
            parsedLeadData.last_name || parsedLeadData.lastname || ""
          }`.trim() || null
        : null) ||
      null
    );
  } catch (error) {
    console.error("Error extracting lead name:", error);
    // Fallback to simple extraction
    const parsedLeadData = typeof leadData === "string" 
      ? JSON.parse(leadData) 
      : leadData;
    return (
      parsedLeadData?.business_name ||
      parsedLeadData?.businessName ||
      parsedLeadData?.name ||
      parsedLeadData?.title ||
      null
    );
  }
};

export const addNote = async ({
  content,
  type,
  notebleId,
  notebleType,
  userId,
}: AddNoteParams) => {
  const note = await Note.create({
    content,
    type,
    notebleId,
    notebleType,
    createdBy: userId,
  });

  const fullNote = await Note.findByPk(note.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });

  await logLeadActivity({
    entityId: notebleId,
    entityType: notebleType === "lead" ? "lead" : "clientLead",
    action: "note_added",
    performedBy: userId,
    details: `Note added: "${content}"`,
  });

  return fullNote;
};

interface GetNotesParams {
  notebleId: number;
  notebleType: "lead" | "client_lead";
}

export const getNotesForEntity = async ({
  notebleId,
  notebleType,
}: GetNotesParams) => {
  return Note.findAll({
    where: { notebleId, notebleType },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
};

/**
 * Get all notes with pagination (filtered by user role)
 * For admin: returns all notes from all users
 * For non-admin: returns only notes created by the user
 */
export const getAllNotesWithPagination = async (
  page: number = 1,
  limit: number = 10,
  userId?: number,
  isAdmin: boolean = false
) => {
  const Lead = (await import("../models/lead.model")).default;
  const offset = (page - 1) * limit;

  const whereCondition: any = {
    type: "comment",
    notebleType: "lead", // Only show notes on leads
  };

  // For non-admin users, only show their own notes
  if (!isAdmin && userId) {
    whereCondition.createdBy = userId;
  }

  const { count, rows: notes } = await Note.findAndCountAll({
    where: whereCondition,
    include: [
      { 
        model: User, 
        as: "creator", 
        attributes: ["id", "firstname", "lastname", "email"] 
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  // Fetch lead information for each note
  const notesWithLeads = await Promise.all(
    notes.map(async (note: any) => {
      let lead = null;
      if (note.notebleType === "lead" && note.notebleId) {
        lead = await Lead.findByPk(note.notebleId, {
          attributes: ["id", "campaignName", "leadData"],
        });
      }
      
      // Extract phone and name/title from leadData based on campaign fields
      let phoneNumber = null;
      let businessName = null;
      if (lead && lead.leadData) {
        const leadData = typeof lead.leadData === "string" 
          ? JSON.parse(lead.leadData) 
          : lead.leadData;
        phoneNumber = leadData?.phone || leadData?.phone_number || leadData?.number || null;
        // Use helper function to extract name based on campaign fields
        businessName = await extractLeadName(lead.campaignName, lead.leadData);
      }
      
      return {
        ...note.toJSON(),
        lead: lead ? {
          id: lead.id,
          campaignName: lead.campaignName,
          leadCode: lead.leadCode || `${lead.campaignName?.split(" ").map((w: string) => w[0]?.toUpperCase() || "").join("")}${lead.id}`,
          phoneNumber,
          businessName,
        } : null,
      };
    })
  );

  return {
    notes: notesWithLeads,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    pageSize: limit,
  };
};

export const addReminder = async ({
  content,
  reminderDate,
  reminderType,
  notebleId,
  notebleType,
  userId,
}: AddReminderParams) => {
  let parsedDate: Date | undefined = undefined;

  if (reminderDate !== undefined && reminderDate !== null) {
    if (reminderDate instanceof Date) {
      parsedDate = reminderDate;
    } else {
      const tempDate = new Date(reminderDate);
      if (!Number.isNaN(tempDate.getTime())) {
        parsedDate = tempDate;
      }
    }
  }

  const reminder = await Note.create({
    content,
    type: "reminder",
    notebleId,
    notebleType,
    createdBy: userId,
    reminderDate: parsedDate,
    reminderType,
  });

  const fullReminder = await Note.findByPk(reminder.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });

  let datePart = "";
  if (parsedDate) {
    datePart = ` (Date: ${parsedDate.toISOString().split("T")[0]})`;
  }
  await logLeadActivity({
    entityId: notebleId,
    entityType: notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_added",
    performedBy: userId,
    details: `Reminder set: "${content}"${datePart}`,
  });

  return fullReminder;
};

export const getRemindersForEntity = async ({
  notebleId,
  notebleType,
}: GetRemindersParams) => {
  return Note.findAll({
    where: {
      notebleId,
      notebleType,
      type: "reminder",
    },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
};

/**
 * Get upcoming reminders for a user within the next N minutes.
 * Used for in-app popup notifications.
 */
export const getUpcomingRemindersForUser = async (
  userId: number,
  windowMinutes: number = 10
) => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

  return Note.findAll({
    where: {
      type: "reminder",
      createdBy: userId,
      reminderDate: {
        [Op.between]: [now, windowEnd],
      },
    },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["reminderDate", "ASC"]],
  });
};

/**
 * Get recent notes for a user (comments only, not reminders).
 * Used for dashboard display.
 * @param userId - The user ID to get notes for
 * @param limit - Maximum number of notes to return (default: 10)
 * @returns Array of recent notes created by the user with lead information
 */
export const getRecentNotesForUser = async (
  userId: number,
  limit: number = 10
) => {
  const Lead = (await import("../models/lead.model")).default;
  
  const notes = await Note.findAll({
    where: {
      type: "comment",
      createdBy: userId,
      notebleType: "lead", // Only show notes on leads
    },
    include: [
      { 
        model: User, 
        as: "creator", 
        attributes: ["id", "firstname", "lastname", "email"] 
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  // Fetch lead information for each note
  const notesWithLeads = await Promise.all(
    notes.map(async (note: any) => {
      let lead = null;
      if (note.notebleType === "lead" && note.notebleId) {
        lead = await Lead.findByPk(note.notebleId, {
          attributes: ["id", "campaignName", "leadData"],
        });
      }
      
      // Extract phone and name/title from leadData based on campaign fields
      let phoneNumber = null;
      let businessName = null;
      if (lead && lead.leadData) {
        const leadData = typeof lead.leadData === "string" 
          ? JSON.parse(lead.leadData) 
          : lead.leadData;
        phoneNumber = leadData?.phone || leadData?.phone_number || leadData?.number || null;
        // Use helper function to extract name based on campaign fields
        businessName = await extractLeadName(lead.campaignName, lead.leadData);
      }
      
      return {
        ...note.toJSON(),
        lead: lead ? {
          id: lead.id,
          campaignName: lead.campaignName,
          leadCode: lead.leadCode || `${lead.campaignName?.split(" ").map((w: string) => w[0]?.toUpperCase() || "").join("")}${lead.id}`,
          phoneNumber,
          businessName,
        } : null,
      };
    })
  );

  return notesWithLeads;
};

/**
 * Get recent notes from all users (for admin dashboard).
 * Used for dashboard display to show recent activity across all users.
 * @param limit - Maximum number of notes to return (default: 10)
 * @returns Array of recent notes from all users with lead information
 */
export const getRecentNotesForAdmin = async (
  limit: number = 10
) => {
  const Lead = (await import("../models/lead.model")).default;
  
  const notes = await Note.findAll({
    where: {
      type: "comment",
      notebleType: "lead", // Only show notes on leads
    },
    include: [
      { 
        model: User, 
        as: "creator", 
        attributes: ["id", "firstname", "lastname", "email"] 
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  // Fetch lead information for each note
  const notesWithLeads = await Promise.all(
    notes.map(async (note: any) => {
      let lead = null;
      if (note.notebleType === "lead" && note.notebleId) {
        lead = await Lead.findByPk(note.notebleId, {
          attributes: ["id", "campaignName", "leadData"],
        });
      }
      
      // Extract phone and name/title from leadData based on campaign fields
      let phoneNumber = null;
      let businessName = null;
      if (lead && lead.leadData) {
        const leadData = typeof lead.leadData === "string" 
          ? JSON.parse(lead.leadData) 
          : lead.leadData;
        phoneNumber = leadData?.phone || leadData?.phone_number || leadData?.number || null;
        // Use helper function to extract name based on campaign fields
        businessName = await extractLeadName(lead.campaignName, lead.leadData);
      }
      
      return {
        ...note.toJSON(),
        lead: lead ? {
          id: lead.id,
          campaignName: lead.campaignName,
          leadCode: lead.leadCode || `${lead.campaignName?.split(" ").map((w: string) => w[0]?.toUpperCase() || "").join("")}${lead.id}`,
          phoneNumber,
          businessName,
        } : null,
      };
    })
  );

  return notesWithLeads;
};

export const updateNote = async (
  id: number,
  data: Partial<Note>,
  userId: number
) => {
  const note = await Note.findByPk(id);
  if (!note) throw new Error("Note not found");
  if (note.type !== "comment") throw new Error("This is not a note");

  await note.update(data);

  await logLeadActivity({
    entityId: note.notebleId,
    entityType: note.notebleType === "lead" ? "lead" : "clientLead",
    action: "note_updated",
    performedBy: userId,
    details: `Note updated: "${note.content}"`,
  });

  return note;
};

export const deleteNote = async (id: number, userId: number) => {
  const note = await Note.findByPk(id);
  if (!note) throw new Error("Note not found");
  if (note.type !== "comment") throw new Error("This is not a note");

  await note.destroy();

  await logLeadActivity({
    entityId: note.notebleId,
    entityType: note.notebleType === "lead" ? "lead" : "clientLead",
    action: "note_deleted",
    performedBy: userId,
    details: `Note deleted: "${note.content}"`,
  });

  return { message: "Note deleted successfully" };
};

export const updateReminder = async (
  id: number,
  data: Partial<Note>,
  userId: number
) => {
  const reminder = await Note.findByPk(id);
  if (!reminder) throw new Error("Reminder not found");
  if (reminder.type !== "reminder") throw new Error("This is not a reminder");

  await reminder.update(data);

  await logLeadActivity({
    entityId: reminder.notebleId,
    entityType: reminder.notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_updated",
    performedBy: userId,
    details: `Reminder updated: "${reminder.content}"`,
  });

  return reminder;
};

export const deleteReminder = async (id: number, userId: number) => {
  const reminder = await Note.findByPk(id);
  if (!reminder) throw new Error("Reminder not found");
  if (reminder.type !== "reminder") throw new Error("This is not a reminder");

  await reminder.destroy();

  await logLeadActivity({
    entityId: reminder.notebleId,
    entityType: reminder.notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_deleted",
    performedBy: userId,
    details: `Reminder deleted: "${reminder.content}"`,
  });

  return { message: "Reminder deleted successfully" };
};
