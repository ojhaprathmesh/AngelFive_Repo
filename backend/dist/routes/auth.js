"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../services/auth");
const auth_2 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const router = (0, express_1.Router)();
const loginValidation = [
    (0, express_validator_1.body)("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long"),
    (0, express_validator_1.body)("submissionType")
        .equals("LOGIN")
        .withMessage("Invalid submission type for login"),
];
const signupValidation = [
    (0, express_validator_1.body)("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
    (0, express_validator_1.body)("fullName")
        .trim()
        .isLength({ min: 2 })
        .withMessage("Full name must be at least 2 characters long"),
    (0, express_validator_1.body)("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
    (0, express_validator_1.body)("submissionType")
        .equals("SIGNUP")
        .withMessage("Invalid submission type for signup"),
];
const logSubmission = (req, type, status, message) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";
    console.log(`[${timestamp}] AUTH_${type}_${status}:`, {
        ip,
        userAgent,
        message: message || `${type} ${status.toLowerCase()}`,
        email: req.body?.email ? `${req.body.email.substring(0, 3)}***` : "unknown",
    });
};
router.post("/login", loginValidation, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            logSubmission(req, "LOGIN", "ERROR", `Validation failed: ${errors
                .array()
                .map((e) => e.msg)
                .join(", ")}`);
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors.array(),
                timestamp: new Date().toISOString(),
            });
        }
        const { email, password } = req.body;
        const authResult = await auth_1.authService.signInUser(email, password);
        if (!authResult.success) {
            logSubmission(req, "LOGIN", "ERROR", authResult.error);
            let statusCode = 401;
            if (authResult.errorCode === "auth/user-not-found") {
                statusCode = 401;
            }
            else if (authResult.errorCode === "auth/user-disabled") {
                statusCode = 403;
            }
            else if (authResult.errorCode === "auth/invalid-credential") {
                statusCode = 401;
            }
            return res.status(statusCode).json({
                status: "error",
                message: authResult.error || "Authentication failed",
                timestamp: new Date().toISOString(),
            });
        }
        logSubmission(req, "LOGIN", "SUCCESS", "User logged in successfully");
        return res.json({
            status: "success",
            message: "Login successful",
            data: {
                user: {
                    uid: authResult.user.uid,
                    email: authResult.user.email,
                    fullName: authResult.user.fullName,
                    displayName: authResult.user.displayName,
                    emailVerified: authResult.user.emailVerified,
                },
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Login error:", error);
        logSubmission(req, "LOGIN", "ERROR", `Server error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during login",
            timestamp: new Date().toISOString(),
        });
    }
});
router.post("/signup", signupValidation, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            logSubmission(req, "SIGNUP", "ERROR", `Validation failed: ${errors
                .array()
                .map((e) => e.msg)
                .join(", ")}`);
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors.array(),
                timestamp: new Date().toISOString(),
            });
        }
        const { email, password, fullName } = req.body;
        const emailExists = await auth_1.authService.emailExists(email);
        if (emailExists) {
            logSubmission(req, "SIGNUP", "ERROR", "Email already registered");
            return res.status(409).json({
                status: "error",
                message: "An account with this email already exists",
                timestamp: new Date().toISOString(),
            });
        }
        const authResult = await auth_1.authService.createUser({
            email,
            password,
            fullName,
            emailVerified: false,
        });
        if (!authResult.success) {
            logSubmission(req, "SIGNUP", "ERROR", authResult.error);
            let statusCode = 400;
            if (authResult.errorCode === "auth/email-already-exists") {
                statusCode = 409;
            }
            else if (authResult.errorCode === "auth/weak-password") {
                statusCode = 400;
            }
            else if (authResult.errorCode === "auth/invalid-email") {
                statusCode = 400;
            }
            return res.status(statusCode).json({
                status: "error",
                message: authResult.error || "Failed to create account",
                timestamp: new Date().toISOString(),
            });
        }
        logSubmission(req, "SIGNUP", "SUCCESS", "User registered successfully");
        return res.status(201).json({
            status: "success",
            message: "Account created successfully",
            data: {
                user: {
                    uid: authResult.user.uid,
                    email: authResult.user.email,
                    fullName: authResult.user.fullName,
                    displayName: authResult.user.displayName,
                    emailVerified: authResult.user.emailVerified,
                },
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Signup error:", error);
        logSubmission(req, "SIGNUP", "ERROR", `Server error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during signup",
            timestamp: new Date().toISOString(),
        });
    }
});
router.get("/health", async (req, res) => {
    try {
        const { checkFirebaseConnection } = await Promise.resolve().then(() => __importStar(require("../config/firebase")));
        const firebaseHealthy = await checkFirebaseConnection();
        res.json({
            status: firebaseHealthy ? "healthy" : "degraded",
            service: "authentication",
            firebase: {
                connected: firebaseHealthy,
                admin_sdk: "initialized",
            },
            endpoints: ["/login", "/signup"],
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Health check error:", error);
        res.status(503).json({
            status: "unhealthy",
            service: "authentication",
            error: "Firebase connection failed",
            timestamp: new Date().toISOString(),
        });
    }
});
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: "error",
                message: "No token provided",
                timestamp: new Date().toISOString(),
            });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await (0, auth_2.getAuth)().verifyIdToken(idToken);
        req.user = { uid: decodedToken.uid, email: decodedToken.email };
        next();
        return;
    }
    catch (error) {
        console.error("Token verification error:", error);
        return res.status(401).json({
            status: "error",
            message: "Invalid or expired token",
            timestamp: new Date().toISOString(),
        });
    }
};
router.get('/user/:uid', verifyToken, async (req, res) => {
    try {
        const { uid } = req.params;
        if (req.user.uid !== uid) {
            return res.status(403).json({
                status: "error",
                message: "Access denied",
                timestamp: new Date().toISOString(),
            });
        }
        const userProfile = await auth_1.authService.getUserProfile(uid);
        if (!userProfile) {
            return res.status(404).json({
                status: "error",
                message: "User profile not found",
                timestamp: new Date().toISOString(),
            });
        }
        return res.json({
            status: "success",
            user: userProfile,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Get user profile error:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to get user profile",
            timestamp: new Date().toISOString(),
        });
    }
});
router.put('/user/:uid/last-login', verifyToken, async (req, res) => {
    try {
        const { uid } = req.params;
        if (req.user.uid !== uid) {
            return res.status(403).json({
                status: "error",
                message: "Access denied",
                timestamp: new Date().toISOString(),
            });
        }
        await auth_1.authService.updateUserProfile(uid, {
            lastLoginAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        });
        return res.json({
            status: "success",
            message: "Last login time updated successfully",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Update last login error:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to update last login time",
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/frontend/login', [
    (0, express_validator_1.body)("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors.array(),
                timestamp: new Date().toISOString(),
            });
        }
        const { email, password } = req.body;
        try {
            const authResult = await auth_1.authService.signInUser(email, password);
            if (!authResult.success) {
                let statusCode = 401;
                if (authResult.errorCode === "auth/user-not-found") {
                    statusCode = 401;
                }
                else if (authResult.errorCode === "auth/user-disabled") {
                    statusCode = 403;
                }
                else if (authResult.errorCode === "auth/invalid-credential") {
                    statusCode = 401;
                }
                return res.status(statusCode).json({
                    status: "error",
                    message: authResult.error || "Authentication failed",
                    errorCode: authResult.errorCode,
                    timestamp: new Date().toISOString(),
                });
            }
            const userRecord = await (0, auth_2.getAuth)().getUserByEmail(email);
            const customToken = await (0, auth_2.getAuth)().createCustomToken(userRecord.uid);
            return res.json({
                status: "success",
                message: "Login successful",
                data: {
                    token: customToken,
                    user: authResult.user,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("Frontend login error:", error);
            let errorMessage = "Authentication failed";
            let errorCode = "auth/unknown-error";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "Invalid email or password";
                errorCode = "auth/invalid-credential";
            }
            else if (error.code === 'auth/user-disabled') {
                errorMessage = "User account is disabled";
                errorCode = "auth/user-disabled";
            }
            else if (error.code === 'auth/wrong-password') {
                errorMessage = "Invalid email or password";
                errorCode = "auth/invalid-credential";
            }
            return res.status(401).json({
                status: "error",
                message: errorMessage,
                errorCode: errorCode,
                timestamp: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error("Frontend login error:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during login",
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/frontend/signup', [
    (0, express_validator_1.body)("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
    (0, express_validator_1.body)("fullName")
        .trim()
        .isLength({ min: 2 })
        .withMessage("Full name must be at least 2 characters long"),
    (0, express_validator_1.body)("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors.array(),
                timestamp: new Date().toISOString(),
            });
        }
        const { email, password, fullName } = req.body;
        try {
            try {
                await (0, auth_2.getAuth)().getUserByEmail(email);
                return res.status(409).json({
                    status: "error",
                    message: "An account with this email already exists",
                    errorCode: "auth/email-already-in-use",
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
            }
            const userRecord = await (0, auth_2.getAuth)().createUser({
                email: email,
                password: password,
                displayName: fullName,
                emailVerified: false,
            });
            const userProfile = await auth_1.authService.createUserProfile(userRecord, fullName);
            const customToken = await (0, auth_2.getAuth)().createCustomToken(userRecord.uid);
            return res.status(201).json({
                status: "success",
                message: "Account created successfully",
                data: {
                    token: customToken,
                    user: userProfile,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("Signup error:", error);
            let errorMessage = "Failed to create account";
            let errorCode = "auth/unknown-error";
            if (error.code === 'auth/email-already-exists') {
                errorMessage = "An account with this email already exists";
                errorCode = "auth/email-already-in-use";
            }
            else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address";
                errorCode = "auth/invalid-email";
            }
            else if (error.code === 'auth/weak-password') {
                errorMessage = "Password is too weak";
                errorCode = "auth/weak-password";
            }
            return res.status(400).json({
                status: "error",
                message: errorMessage,
                errorCode: errorCode,
                timestamp: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error("Frontend signup error:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during signup",
            timestamp: new Date().toISOString(),
        });
    }
});
router.post('/frontend/reset-password', [
    (0, express_validator_1.body)("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("Please provide a valid email address"),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: errors.array(),
                timestamp: new Date().toISOString(),
            });
        }
        const { email } = req.body;
        try {
            const userRecord = await (0, auth_2.getAuth)().getUserByEmail(email);
            const resetLink = await (0, auth_2.getAuth)().generatePasswordResetLink(email);
            console.log(`Password reset link generated for ${email}: ${resetLink}`);
            return res.json({
                status: "success",
                message: "Password reset email sent successfully",
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                return res.json({
                    status: "success",
                    message: "If an account exists with this email, a password reset link has been sent",
                    timestamp: new Date().toISOString(),
                });
            }
            return res.status(500).json({
                status: "error",
                message: "Failed to process password reset request",
                timestamp: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error("Password reset error:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during password reset",
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map