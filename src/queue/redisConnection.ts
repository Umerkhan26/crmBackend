// export const connection = {
//     host: 'localhost',
//     port: 6379,
//   };
//   //

import dotenv from "dotenv";
dotenv.config();

export const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD, // Uncomment if needed
};
