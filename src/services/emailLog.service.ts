import EmailLog from "../models/emailLog.model";

export const logEmailStatus = async (entry: any) => {
  await EmailLog.create(entry);
};
