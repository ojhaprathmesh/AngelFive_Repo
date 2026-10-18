import dotenv from "dotenv";
dotenv.config({ override: true });

// Import workers to initialize background job listeners
import "./index";

import { logger } from "../lib/logger";
import { initQueues } from "../lib/queue";
import { shutdownWorkers } from "../lib/worker";

logger.info("[Worker Process] Background job workers starting up...");

// Initialize standard queues
initQueues();

// Graceful shutdown handling
const handleShutdown = async (signal: string) => {
  logger.info(
    `[Worker Process] ${signal} received. Shutting down gracefully...`,
  );
  try {
    await shutdownWorkers();
    logger.info("[Worker Process] Shutdown complete. Exiting.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "[Worker Process] Error during worker shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
process.on("SIGINT", () => void handleShutdown("SIGINT"));
