import EmailTemplate from "../models/emailTemplate.model"; // already typed now
import { renderTemplate } from "../utils/templateRenderer";

export const getCompiledTemplate = async (
  serviceName: string,
  data: any,
  subjectOverride?: string,
  bodyOverride?: string
) => {
  const template = await EmailTemplate.findOne({ where: { serviceName } });

  if (!template) throw new Error("Email template not found");

  const subject = renderTemplate(subjectOverride || template.subjectTemplate, data);
  const body = renderTemplate(bodyOverride || template.bodyTemplate, data);

  return { subject, body };
};
