import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, onAuthStateChanged, signOut, User, } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

try {
    // Initialize Firebase app
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }

    // Initialize Firebase services
    auth = getAuth(app);

    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
}

// User profile interface matching backend schema
export interface UserProfile {
    uid: string;
    email: string;
    fullName: string;
    displayName?: string | null;
    photoURL?: string | null;
    emailVerified: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastLoginAt?: Timestamp;
}

// Authentication result interface
export interface AuthResult {
    success: boolean;
    user?: UserProfile;
    error?: string;
    errorCode?: string;
}

// Authentication operation type
export type AuthOperation = "login" | "signup";

// Authentication request interface
export interface AuthRequest {
    operation: AuthOperation;
    email: string;
    password: string;
    fullName?: string;
    confirmPassword?: string;
}

// Validation result interface
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// Firebase Authentication Service for Frontend
export class FirebaseClientAuth {
    private static instance: FirebaseClientAuth;

    private constructor() {
    }

    public static getInstance(): FirebaseClientAuth {
        if (!FirebaseClientAuth.instance) {
            FirebaseClientAuth.instance = new FirebaseClientAuth();
        }
        return FirebaseClientAuth.instance;
    }

    /**
     * Unified authentication function that handles both login and signup operations
     *
     * @param request - Authentication request containing operation type, credentials, and optional user data
     * @returns Promise<AuthResult> - Result object containing success status, user data, or error information
     *
     * @example
     * // Login example
     * const loginResult = await authService.authenticate({
     *   operation: 'login',
     *   email: 'user@example.com',
     *   password: 'password123'
     * });
     *
     * @example
     * // Signup example
     * const signupResult = await authService.authenticate({
     *   operation: 'signup',
     *   email: 'sahil.mane23cse@bmu.edu.in',
     *   password: 'password123',
     *   confirmPassword: 'password123',
     *   fullName: 'John Doe'
     * });
     */
    async authenticate(request: AuthRequest): Promise<AuthResult> {
        try {
            // Validate input
            const validation = this.validateAuthRequest(request);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(", "),
                    errorCode: "validation-error",
                };
            }

            // Route to appropriate authentication method
            if (request.operation === "login") {
                return await this.signIn(request.email, request.password);
            } else if (request.operation === "signup") {
                if (!request.fullName) {
                    return {
                        success: false,
                        error: "Full name is required for signup",
                        errorCode: "missing-full-name",
                    };
                }
                return await this.signUp(
                    request.email,
                    request.password,
                    request.fullName,
                );
            } else {
                return {
                    success: false,
                    error: "Invalid operation type",
                    errorCode: "invalid-operation",
                };
            }
        } catch (error: unknown) {
            console.error("Authentication error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "An unexpected error occurred";
            const errorCode = (error as { code?: string })?.code || "unknown-error";
            return {
                success: false,
                error: errorMessage,
                errorCode: errorCode,
            };
        }
    }

    /**
     * Validates authentication request data
     *
     * @param request - Authentication request to validate
     * @returns ValidationResult - Object containing validation status and any errors
     */
    private validateAuthRequest(request: AuthRequest): ValidationResult {
        const errors: string[] = [];

        // Validate email
        if (!request.email || !request.email.trim()) {
            errors.push("Email is required");
        } else if (!this.isValidEmail(request.email)) {
            errors.push("Invalid email format");
        }

        // Validate password
        if (!request.password || !request.password.trim()) {
            errors.push("Password is required");
        } else if (request.password.length < 6) {
            errors.push("Password must be at least 6 characters long");
        }

        // Additional validation for signup
        if (request.operation === "signup") {
            if (!request.fullName || !request.fullName.trim()) {
                errors.push("Full name is required for signup");
            }

            if (!request.confirmPassword) {
                errors.push("Password confirmation is required");
            } else if (request.password !== request.confirmPassword) {
                errors.push("Passwords do not match");
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validates email format using a simple regex
     *
     * @param email - Email string to validate
     * @returns boolean - True if email format is valid
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async signUp(
        email: string,
        password: string,
        fullName: string,
    ): Promise<AuthResult> {
        try {
            // Use backend API for signup instead of direct Firebase calls
            const apiUrl =
                process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
            const response = await fetch(`${apiUrl}/api/auth/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    confirmPassword: password, // Since we're handling validation in backend
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || "Signup failed",
                    errorCode: data.errorCode || "unknown-error",
                };
            }

            // Sign in with the custom token returned from backend
            if (data.data?.token) {
                const { signInWithCustomToken } = await import("firebase/auth");
                await signInWithCustomToken(auth, data.data.token);

                return {
                    success: true,
                    user: data.data.user,
                };
            }

            return {
                success: true,
                user: data.data.user,
            };
        } catch (error: unknown) {
            console.error("Sign up error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "An unexpected error occurred";
            const errorCode = (error as { code?: string })?.code || "unknown-error";
            return {
                success: false,
                error: errorMessage,
                errorCode: errorCode,
            };
        }
    }

    /**
     * Sign in with email and password via backend API
     */
    async signIn(email: string, password: string): Promise<AuthResult> {
        try {
            const apiUrl =
                process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
            const response = await fetch(`${apiUrl}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || "Login failed",
                    errorCode: data.errorCode || "unknown-error",
                };
            }

            // Sign in with the custom token returned from backend
            if (data.data?.token) {
                const { signInWithCustomToken } = await import("firebase/auth");
                const userCredential = await signInWithCustomToken(auth, data.data.token);

                // Force token refresh so ID token is immediately valid for API calls
                await userCredential.user.getIdToken(true);

                return {
                    success: true,
                    user: data.data.user,
                };
            }

            return {
                success: true,
                user: data.data.user,
            };
        } catch (error: unknown) {
            console.error("Sign in error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "An unexpected error occurred";
            const errorCode = (error as { code?: string })?.code || "unknown-error";
            return {
                success: false,
                error: errorMessage,
                errorCode: errorCode,
            };
        }
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<boolean> {
        try {
            await signOut(auth);
            return true;
        } catch (error) {
            console.error("Sign out error:", error);
            return false;
        }
    }

    /**
     * Listen to authentication state changes
     */
    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        return onAuthStateChanged(auth, callback);
    }

    /**
     * Get user profile from backend API (to avoid Firestore permission issues)
     */
    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const user = auth.currentUser;
            if (!user) {
                return null;
            }

            let token = await user.getIdToken(true);

            const apiUrl =
                process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
            let response = await fetch(`${apiUrl}/api/auth/user/${uid}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.status === 403 || response.status === 401) {
                token = await user.getIdToken(true);
                const apiUrl =
                    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
                response = await fetch(`${apiUrl}/api/auth/user/${uid}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });
            }

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("User profile not found");
                    return null;
                }
                return null;
            }

            const data = await response.json();
            return data.user || null;
        } catch (error) {
            console.error("Error getting user profile via API:", error);
            return null;
        }
    }
}

// Export Firebase services and auth instance
export { auth };
export const firebaseClientAuth = FirebaseClientAuth.getInstance();

// Export auth service for easier access
export const authService = firebaseClientAuth;
