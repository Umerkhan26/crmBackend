import EmailTemplate from "../models/emailTemplate.model";
import { Request, Response } from "express";

// Get all templates
export const getEmailTemplates = async (req: Request, res: Response) => {
  const templates = await EmailTemplate.findAll();
  res.json(templates);
};

// Update template by ID
export const updateEmailTemplate = async (req: Request, res: Response):Promise<any> => {
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
