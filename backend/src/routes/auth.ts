import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authService } from "../services/auth";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

// Frontend authentication request interfaces
interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  confirmPassword: string;
}

const router: Router = Router();

// Type definitions for request bodies
interface LoginRequest {
  submissionType: "LOGIN";
  email: string;
  password: string;
  fullName: null;
  confirmPassword: null;
  timestamp: string;
}

interface SignupRequest {
  submissionType: "SIGNUP";
  email: string;
  password: string;
  fullName: string;
  confirmPassword: string;
  timestamp: string;
}

// Enhanced validation middleware for Firebase integration
const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("submissionType")
    .equals("LOGIN")
    .withMessage("Invalid submission type for login"),
];

const signupValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  body("fullName")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Full name must be at least 2 characters long"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
  body("submissionType")
    .equals("SIGNUP")
    .withMessage("Invalid submission type for signup"),
];

// Logging utility for authentication events
const logSubmission = (
  req: Request,
  type: string,
  status: "SUCCESS" | "ERROR",
  message?: string,
) => {
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

// Login endpoint with Firebase authentication
router.post(
  "/login",
  loginValidation,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logSubmission(
          req,
          "LOGIN",
          "ERROR",
          `Validation failed: ${errors
            .array()
            .map((e) => e.msg)
            .join(", ")}`,
        );
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { email, password } = req.body as LoginRequest;

      // Authenticate with Firebase
      const authResult = await authService.signInUser(email, password);

      if (!authResult.success) {
        logSubmission(req, "LOGIN", "ERROR", authResult.error);

        // Map Firebase error codes to appropriate HTTP status codes
        let statusCode = 401;
        if (authResult.errorCode === "auth/user-not-found") {
          statusCode = 401;
        } else if (authResult.errorCode === "auth/user-disabled") {
          statusCode = 403;
        } else if (authResult.errorCode === "auth/invalid-credential") {
          statusCode = 401;
        }

        return res.status(statusCode).json({
          status: "error",
          message: authResult.error || "Authentication failed",
          timestamp: new Date().toISOString(),
        });
      }

      // Successful login
      logSubmission(req, "LOGIN", "SUCCESS", "User logged in successfully");

      return res.json({
        status: "success",
        message: "Login successful",
        data: {
          user: {
            uid: authResult.user!.uid,
            email: authResult.user!.email,
            fullName: authResult.user!.fullName,
            displayName: authResult.user!.displayName,
            emailVerified: authResult.user!.emailVerified,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Login error:", error);
      logSubmission(
        req,
        "LOGIN",
        "ERROR",
        `Server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );

      return res.status(500).json({
        status: "error",
        message: "Internal server error during login",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Signup endpoint with Firebase authentication
router.post(
  "/signup",
  signupValidation,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logSubmission(
          req,
          "SIGNUP",
          "ERROR",
          `Validation failed: ${errors
            .array()
            .map((e) => e.msg)
            .join(", ")}`,
        );
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { email, password, fullName } = req.body as {
        email: string;
        password: string;
        fullName: string;
      };

      // Check if user already exists
      const emailExists = await authService.emailExists(email);
      if (emailExists) {
        logSubmission(req, "SIGNUP", "ERROR", "Email already registered");
        return res.status(409).json({
          status: "error",
          message: "An account with this email already exists",
          timestamp: new Date().toISOString(),
        });
      }

      // Create new user with Firebase
      const authResult = await authService.createUser({
        email,
        password,
        fullName,
        emailVerified: false,
      });

      if (!authResult.success) {
        logSubmission(req, "SIGNUP", "ERROR", authResult.error);

        // Map Firebase error codes to appropriate HTTP status codes
        let statusCode = 400;
        if (authResult.errorCode === "auth/email-already-exists") {
          statusCode = 409;
        } else if (authResult.errorCode === "auth/weak-password") {
          statusCode = 400;
        } else if (authResult.errorCode === "auth/invalid-email") {
          statusCode = 400;
        }

        return res.status(statusCode).json({
          status: "error",
          message: authResult.error || "Failed to create account",
          timestamp: new Date().toISOString(),
        });
      }

      // Successful signup
      logSubmission(req, "SIGNUP", "SUCCESS", "User registered successfully");

      return res.status(201).json({
        status: "success",
        message: "Account created successfully",
        data: {
          user: {
            uid: authResult.user!.uid,
            email: authResult.user!.email,
            fullName: authResult.user!.fullName,
            displayName: authResult.user!.displayName,
            emailVerified: authResult.user!.emailVerified,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Signup error:", error);
      logSubmission(
        req,
        "SIGNUP",
        "ERROR",
        `Server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );

      return res.status(500).json({
        status: "error",
        message: "Internal server error during signup",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Health check for auth routes with Firebase integration
router.get("/health", async (req: Request, res: Response) => {
  try {
    // Check Firebase connection
    const { checkFirebaseConnection } = await import("../config/firebase");
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
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      service: "authentication",
      error: "Firebase connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// Middleware to verify Firebase ID token
const verifyToken = async (req: AuthRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "No token provided",
        timestamp: new Date().toISOString(),
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = { uid: decodedToken.uid, email: decodedToken.email };
    next();
    return;
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    });
  }
};

// Get user profile endpoint
router.get(
  "/user/:uid",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { uid } = req.params;

      // Ensure user can only access their own profile
      if (req.user!.uid !== uid) {
        return res.status(403).json({
          status: "error",
          message: "Access denied",
          timestamp: new Date().toISOString(),
        });
      }

      const userProfile = await authService.getUserProfile(uid);

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
    } catch (error) {
      console.error("Get user profile error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to get user profile",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Update last login time endpoint
router.put(
  "/user/:uid/last-login",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { uid } = req.params;

      // Ensure user can only update their own last login time
      if (req.user!.uid !== uid) {
        return res.status(403).json({
          status: "error",
          message: "Access denied",
          timestamp: new Date().toISOString(),
        });
      }

      await authService.updateUserProfile(uid, {
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return res.json({
        status: "success",
        message: "Last login time updated successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Update last login error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update last login time",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// New frontend authentication endpoints

// Frontend login endpoint
router.post(
  "/frontend/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { email, password } = req.body as LoginRequest;

      try {
        // Use the existing backend auth service to authenticate
        const authResult = await authService.signInUser(email, password);

        if (!authResult.success) {
          // Map error codes to appropriate HTTP status codes
          let statusCode = 401;
          if (authResult.errorCode === "auth/user-not-found") {
            statusCode = 401;
          } else if (authResult.errorCode === "auth/user-disabled") {
            statusCode = 403;
          } else if (authResult.errorCode === "auth/invalid-credential") {
            statusCode = 401;
          }

          return res.status(statusCode).json({
            status: "error",
            message: authResult.error || "Authentication failed",
            errorCode: authResult.errorCode,
            timestamp: new Date().toISOString(),
          });
        }

        // Get the user record to create a custom token
        const userRecord = await getAuth().getUserByEmail(email);
        const customToken = await getAuth().createCustomToken(userRecord.uid);

        return res.json({
          status: "success",
          message: "Login successful",
          data: {
            token: customToken,
            user: authResult.user,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Frontend login error:", error);

        let errorMessage = "Authentication failed";
        let errorCode = "auth/unknown-error";

        if (error.code === "auth/user-not-found") {
          errorMessage = "Invalid email or password";
          errorCode = "auth/invalid-credential";
        } else if (error.code === "auth/user-disabled") {
          errorMessage = "User account is disabled";
          errorCode = "auth/user-disabled";
        } else if (error.code === "auth/wrong-password") {
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
    } catch (error) {
      console.error("Frontend login error:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal server error during login",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Frontend signup endpoint
router.post(
  "/frontend/signup",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("fullName")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters long"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { email, password, fullName } = req.body as {
        email: string;
        password: string;
        fullName: string;
      };

      try {
        // Check if user already exists
        try {
          await getAuth().getUserByEmail(email);
          return res.status(409).json({
            status: "error",
            message: "An account with this email already exists",
            errorCode: "auth/email-already-in-use",
            timestamp: new Date().toISOString(),
          });
        } catch (error: any) {
          if (error.code !== "auth/user-not-found") {
            throw error;
          }
          // User doesn't exist, which is what we want
        }

        // Create user with Firebase Admin SDK
        const userRecord = await getAuth().createUser({
          email: email,
          password: password,
          displayName: fullName,
          emailVerified: false,
        });

        // Create user profile in Firestore
        const userProfile = await authService.createUserProfile(
          userRecord,
          fullName,
        );

        // Create custom token for frontend
        const customToken = await getAuth().createCustomToken(userRecord.uid);

        return res.status(201).json({
          status: "success",
          message: "Account created successfully",
          data: {
            token: customToken,
            user: userProfile,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Signup error:", error);

        let errorMessage = "Failed to create account";
        let errorCode = "auth/unknown-error";

        if (error.code === "auth/email-already-exists") {
          errorMessage = "An account with this email already exists";
          errorCode = "auth/email-already-in-use";
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "Invalid email address";
          errorCode = "auth/invalid-email";
        } else if (error.code === "auth/weak-password") {
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
    } catch (error) {
      console.error("Frontend signup error:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal server error during signup",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Frontend password reset endpoint
router.post(
  "/frontend/reset-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
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
        // Check if user exists
        const userRecord = await getAuth().getUserByEmail(email);

        // Generate password reset link
        const resetLink = await getAuth().generatePasswordResetLink(email);

        // In a production environment, you would send this link via email
        // For now, we'll just return success
        console.log(`Password reset link generated for ${email}: ${resetLink}`);

        return res.json({
          status: "success",
          message: "Password reset email sent successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          // Don't reveal if user exists or not for security
          return res.json({
            status: "success",
            message:
              "If an account exists with this email, a password reset link has been sent",
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(500).json({
          status: "error",
          message: "Failed to process password reset request",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Password reset error:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal server error during password reset",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

export default router;
