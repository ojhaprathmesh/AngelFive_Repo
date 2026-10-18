import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { ENV } from "./config/env";
import { logger } from "./lib/logger";
import { initQueues } from "./lib/queue";
import { getRedisStatus } from "./lib/redis";
import { shutdownWorkers } from "./lib/worker";
import { computeProfiler } from "./middleware/profiler";
import { requestLogger } from "./middleware/request-logger";
import authRouter from "./routes/auth";
import dsfmRouter from "./routes/dsfm";
import jobsRouter from "./routes/jobs";
import marketRouter from "./routes/market";
import notificationsRouter from "./routes/notifications";
import watchlistRouter from "./routes/watchlists";
import { notificationService } from "./services/notification";
import { syncInstrumentMasterIfStale } from "./utils/instrument-master";

// Explicitly reference notificationService to ensure it's initialized and listeners are attached
const _ = notificationService;

// Import workers to initialize background job listeners conditionally
if (
  process.env.RUN_WORKERS === "true" ||
  (!process.env.RUN_WORKERS && ENV.NODE_ENV !== "production")
) {
  logger.info("[Server] Starting background workers in-process.");
  import("./workers").catch((err) => {
    logger.error({ err }, "[Server] Failed to load workers in-process");
  });
} else {
  logger.info(
    "[Server] Background workers disabled in-process (run separately in worker process).",
  );
}

// Kick off instrument master sync in the background (non-blocking).
// This downloads ~180MB of Angel One scrip data into Redis so that
// symbol→token resolution is O(1) and never depends on a local file.
void syncInstrumentMasterIfStale().catch((err) =>
  logger.error({ err }, "[Server] Instrument master sync failed at startup"),
);

const app: Express = express();
// Trust the first proxy (Render load balancer) to correctly identify client IPs for rate limiting
app.set("trust proxy", 1);
const PORT = ENV.PORT;

/* -------------------------------------------------------------------------- */
/*                               CORS SETTINGS                                */
/* -------------------------------------------------------------------------- */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://angelfive.vercel.app",
  ...ENV.FRONTEND_URL.split(",").map((u) => u.trim()),
];

// Regex patterns for dynamic preview URLs (e.g. Vercel per-branch deployments)
const allowedOriginPatterns = [
  /^https:\/\/angelfive(-[a-z0-9-]+)?\.vercel\.app$/,
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        allowedOriginPatterns.some((re) => re.test(origin))
      ) {
        return callback(null, true);
      }

      logger.warn({ origin }, "Blocked by CORS");
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Handle preflight explicitly
app.options("*", cors());

/* -------------------------------------------------------------------------- */
/*                                MIDDLEWARE                                  */
/* -------------------------------------------------------------------------- */

app.use(helmet());
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/*                                RATE LIMITING                               */
/* -------------------------------------------------------------------------- */

// Global API rate limiter (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
});

// Strict rate limiter for Auth (10 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many authentication attempts, please try again later.",
  },
});

// Moderate rate limiter for Compute-heavy DSFM routes (100 requests per minute)
const dsfmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many compute requests, please try again later.",
  },
});

/* -------------------------------------------------------------------------- */
/*                                  ROUTES                                    */
/* -------------------------------------------------------------------------- */

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/dsfm", dsfmLimiter, computeProfiler, dsfmRouter);
app.use("/api/market", computeProfiler, marketRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/watchlists", watchlistRouter);
app.use("/api/jobs", jobsRouter);

/* -------------------------------------------------------------------------- */
/*                             BASIC & HEALTH ROUTES                          */
/* -------------------------------------------------------------------------- */
let mlStatus: "ok" | "down" | "unknown" = "unknown";
let lastChecked: number | null = null;

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to AngelFive Backend API",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  const redis = getRedisStatus();

  // Respond immediately with last-known status
  res.status(200).json({
    status: "ok",
    services: {
      backend: "ok",
      ml: mlStatus,
      redis: redis.status,
    },
    redis: {
      status: redis.status,
      latencyMs: redis.latencyMs,
    },
    lastMlCheck: lastChecked,
  });

  // Background ML health check (non-blocking)
  void (async () => {
    try {
      const resp = await fetch(`${ENV.ML_SERVICE_URL}/health`);
      mlStatus = resp.ok ? "ok" : "down";
    } catch {
      mlStatus = "down";
    } finally {
      lastChecked = Date.now();
    }
  })();
});

app.get("/api/test", (req: Request, res: Response) => {
  res.status(200).json({
    message: "API is working correctly",
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/*                                404 HANDLER                                 */
/* -------------------------------------------------------------------------- */

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/*                               ERROR HANDLER                                */
/* -------------------------------------------------------------------------- */

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "❌ Server Error");

  res.status(500).json({
    status: "error",
    message: "Internal server error",
    ...(ENV.NODE_ENV === "development" && {
      error: err.message,
    }),
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/*                                START SERVER                                */
/* -------------------------------------------------------------------------- */

initQueues();

app.listen(PORT, () => {
  logger.info({ port: PORT, env: ENV.NODE_ENV }, "🚀 Server running");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  await shutdownWorkers();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...");
  await shutdownWorkers();
  process.exit(0);
});
