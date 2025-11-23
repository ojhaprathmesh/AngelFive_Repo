import dotenv from "dotenv";
import path from "path";

// Load environment variables with absolute paths
const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env.local'), override: true });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Express } from "express";
import authRoutes from "./routes/auth";
import marketRoutes from "./routes/market";
import watchlistRoutes from "./routes/watchlists";
import dsfmRoutes from "./routes/dsfm";

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan("combined")); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/watchlists", watchlistRoutes);
app.use("/api/dsfm", dsfmRoutes);

// Basic routes
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to AngelFive Backend API",
    status: "success",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working correctly",
    data: {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: {
        "user-agent": req.get("User-Agent"),
        "content-type": req.get("Content-Type"),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    code: 404,
    message: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);

    res.status(500).json({
      status: "error",
      code: 500,
      message: "Internal server error",
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API test: http://localhost:${PORT}/api/test`);
  
  // Check for required environment variables for SmartAPI
  // JWT token is generated dynamically, so we don't need SMARTAPI_JWT_TOKEN
  const hasSmartApiKey = !!process.env.SMARTAPI_API_KEY;
  const hasClientCode = !!process.env.SMARTAPI_CLIENT_CODE;
  const hasPassword = !!process.env.SMARTAPI_PASSWORD;
  const hasTotpSecret = !!process.env.SMARTAPI_TOTP_SECRET;
  
  if (!hasSmartApiKey || !hasClientCode || !hasPassword || !hasTotpSecret) {
    console.warn(`⚠️  WARNING: SmartAPI credentials not found!`);
    console.warn(`   SMARTAPI_API_KEY: ${hasSmartApiKey ? '✓' : '✗'}`);
    console.warn(`   SMARTAPI_CLIENT_CODE: ${hasClientCode ? '✓' : '✗'}`);
    console.warn(`   SMARTAPI_PASSWORD: ${hasPassword ? '✓' : '✗'}`);
    console.warn(`   SMARTAPI_TOTP_SECRET: ${hasTotpSecret ? '✓' : '✗'}`);
    console.warn(`   Please add these to backend/.env.local and restart the server`);
    console.warn(`   Note: JWT token will be generated automatically on first API call`);
  } else {
    console.log(`✅ SmartAPI credentials loaded (JWT will be generated automatically)`);
  }
});

export default app;
