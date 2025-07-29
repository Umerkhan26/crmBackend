// utils/getSmtpConfig.ts
import User from "../models/user.model";

export const getSmtpConfig = async (userId: number) => {
  const user = await User.findByPk(userId);

  const smtpConfig = {
    host: user?.smtpoutgoingserver || process.env.DEFAULT_SMTP_HOST,
    port: Number(user?.smtpport || process.env.DEFAULT_SMTP_PORT),
    user: user?.smtpemail || process.env.DEFAULT_SMTP_EMAIL,
    pass: user?.smtppassword || process.env.DEFAULT_SMTP_PASSWORD,
  };
console.log("smpt configuration is ",smtpConfig)
  return smtpConfig;
};
