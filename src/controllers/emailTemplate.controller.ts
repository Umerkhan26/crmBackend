import EmailTemplate from "../models/emailTemplate.model";
import { Request, Response } from "express";

export const getEmailTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await EmailTemplate.findAll({ order: [["id", "ASC"]] });
    res.json(templates);
  } catch (error: any) {
    console.error("[getEmailTemplates]", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to load email templates",
    });
  }
};

export const updateEmailTemplate = async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { name, subjectTemplate, bodyTemplate } = req.body;

  const template = await EmailTemplate.findByPk(id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  template.name = name;
  template.subjectTemplate = subjectTemplate;
  template.bodyTemplate = bodyTemplate;
  await template.save();

  res.json({ message: "Template updated", template });
};
