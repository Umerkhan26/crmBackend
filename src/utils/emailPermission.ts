// utils/emailPermission.ts
import EmailRule from "../models/emailRule.model";

export const canSendEmail = async (service: string): Promise<boolean> => {
  const rule = await EmailRule.findOne({ where: { service } });

  // Default: allow sending if rule not found
  if (!rule) return true;

  return rule.can_send;
};
