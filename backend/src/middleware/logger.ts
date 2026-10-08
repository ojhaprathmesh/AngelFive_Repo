import pinoHttp from "pino-http";
import { v4 as uuidv4 } from "uuid";

import { logger } from "../lib/logger";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: any, res: any) => {
    const existingId = req.id ?? req.headers["x-request-id"];
    if (existingId) return existingId;
    const id = uuidv4();
    res.setHeader("x-request-id", id);
    return id;
  },
  customProps: () => ({
    context: "HTTP",
  }),
  customLogLevel: (req: any, res: any, err: any) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return "warn";
    } else if (res.statusCode >= 500 || err) {
      return "error";
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return "silent";
    }

    // Suppress noisy routes
    if (req.url?.includes("/stream") || req.url?.includes("/health")) {
      return "silent";
    }
    return "info";
  },
  customSuccessMessage: (req: any, res: any) => {
    return `[HTTP] ${req.method} ${req.url} completed with ${res.statusCode}`;
  },
  customErrorMessage: (req: any, res: any, err: any) => {
    return `[HTTP] ${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
  },
});
