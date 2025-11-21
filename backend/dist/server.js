"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
const path_1 = tslib_1.__importDefault(require("path"));
const backendDir = path_1.default.resolve(__dirname, '..');
dotenv_1.default.config({ path: path_1.default.join(backendDir, '.env.local'), override: true });
const express_1 = tslib_1.__importDefault(require("express"));
const cors_1 = tslib_1.__importDefault(require("cors"));
const helmet_1 = tslib_1.__importDefault(require("helmet"));
const morgan_1 = tslib_1.__importDefault(require("morgan"));
const auth_1 = tslib_1.__importDefault(require("./routes/auth"));
const market_1 = tslib_1.__importDefault(require("./routes/market"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("combined"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/api/auth", auth_1.default);
app.use("/api/market", market_1.default);
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
app.use("*", (req, res) => {
    res.status(404).json({
        status: "error",
        code: 404,
        message: "Route not found",
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
    });
});
app.use((err, req, res, next) => {
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({
        status: "error",
        code: 500,
        message: "Internal server error",
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 API test: http://localhost:${PORT}/api/test`);
});
exports.default = app;
//# sourceMappingURL=server.js.map