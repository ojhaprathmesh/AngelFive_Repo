import dotenv from "dotenv";
dotenv.config();

import { ENV } from "./config/env";

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth";
import marketRoutes from "./routes/market";
import watchlistRoutes from "./routes/watchlists";
import dsfmRoutes from "./routes/dsfm";

const app: Express = express();
const PORT = ENV.PORT;

/* -------------------------------------------------------------------------- */
/*                               CORS SETTINGS                                */
/* -------------------------------------------------------------------------- */

const allowedOrigins = [
    "http://localhost:5173",
    ...ENV.FRONTEND_URL.split(",").map((u) => u.trim()),
];

// Regex patterns for dynamic preview URLs (e.g. Vercel per-branch deployments)
const allowedOriginPatterns = [
    /^https:\/\/angelfive(-[a-z0-9-]+)?\.vercel\.app$/,
];

console.log("Env Variables:", ENV);

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

app.use("/api/auth", authRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/watchlists", watchlistRoutes);
app.use("/api/dsfm", dsfmRoutes);

/* -------------------------------------------------------------------------- */
/*                             BASIC & HEALTH ROUTES                          */
/* -------------------------------------------------------------------------- */

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to AngelFive Backend API",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    });
});

// 🔥 Render Health Check Endpoint
app.get("/health", async (_req: Request, res: Response) => {
    try {
        res.status(200).json({
            status: "healthy",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            memory: process.memoryUsage(),
            environment: ENV.NODE_ENV,
        });
    } catch (error) {
        res.status(503).json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
        });
    }
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
