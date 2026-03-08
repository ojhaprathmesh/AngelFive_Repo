import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { ENV } from "./config/env";
import authRouter from "./routes/auth";
import dsfmRouter from "./routes/dsfm";
import marketRouter from "./routes/market";
import watchlistRouter from "./routes/watchlists";

const app: Express = express();
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

            console.warn("Blocked by CORS:", origin);
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
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/*                                  ROUTES                                    */
/* -------------------------------------------------------------------------- */

app.use("/api/auth", authRouter);
app.use("/api/dsfm", dsfmRouter);
app.use("/api/market", marketRouter);
app.use("/api/watchlists", watchlistRouter);

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
    // Respond immediately
    res.status(200).json({
        status: "ok",
        services: {
            backend: "ok",
            ml: mlStatus
        },
        lastMlCheck: lastChecked
    });

    // Background ML health check
    void (async () => {
        try {
            const resp = await fetch(`${ENV.ML_SERVICE_URL}/health`);
            mlStatus = resp.ok ? "ok" : "down";
        } catch {
            mlStatus = "down";
        } finally {
            lastChecked = Date.now();
        }
    })(); // Immediately Invoked Async Arrow Function (IIFE)
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
    console.error("❌ Server Error:", err.message);

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

app.listen(PORT, () => {
    console.log("=================================");
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${ENV.NODE_ENV}`);
    console.log(`🌐 Health: /health`);
    console.log("=================================");
});
