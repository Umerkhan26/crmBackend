import { Queue } from "bullmq";
import { connection } from "./redisConnection";

/**
 * IMPORTANT:
 * Creating a BullMQ Queue immediately can trigger Redis connections at app startup.
 * If Redis is not available, that can crash the server and break unrelated features (like call tracking).
 *
 * So we lazy-initialize the queue only when it's actually used.
 *
 * You can also disable Redis/queue explicitly with:
 *   DISABLE_REDIS=true
 */
let _queue: Queue | null = null;

const getQueue = () => {
  if (process.env.DISABLE_REDIS === "true") {
    throw new Error("Redis is disabled (DISABLE_REDIS=true). Email queue is unavailable.");
  }
  if (!_queue) {
    _queue = new Queue("emailQueue", { connection });
    // Best-effort: avoid unhandled Redis errors bubbling up.
    (_queue as any).on?.("error", (err: any) => {
      // eslint-disable-next-line no-console
      console.warn("emailQueue redis error:", err?.message || err);
    });
  }
  return _queue;
};

export const emailQueue: Pick<Queue, "add"> = {
  add: (...args: any[]) => (getQueue() as any).add(...args),
};
