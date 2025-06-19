import { Queue } from "bullmq";
import { connection } from "./redisConnection";

export const emailQueue = new Queue("emailQueue", { connection });
