import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
  updateProfile,
  sendEmailVerification,
  AuthError,
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

try {
  // Initialize Firebase app (avoid duplicate initialization)
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  // Initialize Firebase services
  auth = getAuth(app);
  firestore = getFirestore(app);

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
export type AuthOperation = 'login' | 'signup';

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

  private constructor() {}

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
          error: validation.errors.join(', '),
          errorCode: 'validation-error'
        };
      }

      // Route to appropriate authentication method
      if (request.operation === 'login') {
        return await this.signIn(request.email, request.password);
      } else if (request.operation === 'signup') {
        if (!request.fullName) {
          return {
            success: false,
            error: 'Full name is required for signup',
            errorCode: 'missing-full-name'
          };
        }
        return await this.signUp(request.email, request.password, request.fullName);
      } else {
        return {
          success: false,
          error: 'Invalid operation type',
          errorCode: 'invalid-operation'
        };
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
        errorCode: error.code || 'unknown-error'
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
      errors.push('Email is required');
    } else if (!this.isValidEmail(request.email)) {
      errors.push('Invalid email format');
    }

    // Validate password
    if (!request.password || !request.password.trim()) {
      errors.push('Password is required');
    } else if (request.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    // Additional validation for signup
    if (request.operation === 'signup') {
      if (!request.fullName || !request.fullName.trim()) {
        errors.push('Full name is required for signup');
      }

      if (!request.confirmPassword) {
        errors.push('Password confirmation is required');
      } else if (request.password !== request.confirmPassword) {
        errors.push('Passwords do not match');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
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
    fullName: string
  ): Promise<AuthResult> {
    try {
      // Create user with Firebase Auth
      const userCredential: UserCredential =
        await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        // Update user profile
        await updateProfile(user, {
          displayName: fullName,
        });

        // Create user profile in Firestore
        const userProfile = await this.createUserProfile(user, fullName);

        // Send email verification only after successful profile creation
        await sendEmailVerification(user);

        return {
          success: true,
          user: userProfile,
        };
      } catch (profileError) {
        // If profile creation fails, delete the auth user to maintain consistency
        console.error(
          "Profile creation failed, cleaning up auth user:",
          profileError
        );
        await user.delete();
        throw profileError;
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: error.code,
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Update last login time
      await this.updateLastLoginTime(user.uid);

      // Get user profile
      const userProfile = await this.getUserProfile(user.uid);

      return {
        success: true,
        user: userProfile ?? undefined,
      };
    } catch (error: any) {
      console.error("Sign in error:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: error.code,
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
   * Get current user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Get user profile from Firestore
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(firestore, "users", uid));

      if (!userDoc.exists()) {
        console.warn("User profile not found in Firestore");
        return null;
      }

      return userDoc.data() as UserProfile;
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  /**
   * Create user profile in Firestore
   */
  private async createUserProfile(
    user: User,
    fullName: string
  ): Promise<UserProfile> {
    const now = serverTimestamp();

    const userProfile: Omit<UserProfile, "createdAt" | "updatedAt"> & {
      createdAt: any;
      updatedAt: any;
    } = {
      uid: user.uid,
      email: user.email || "",
      fullName,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      emailVerified: user.emailVerified,
      createdAt: now,
      updatedAt: now,
    };

    // Save to Firestore
    await setDoc(doc(firestore, "users", user.uid), userProfile);

    // Return profile with proper timestamp types
    return {
      ...userProfile,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  /**
   * Update last login time
   */
  private async updateLastLoginTime(uid: string): Promise<void> {
    try {
      await updateDoc(doc(firestore, "users", uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating last login time:", error);
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: AuthError): string {
    switch (error.code) {
      case "auth/user-not-found":
        return "No account found with this email address";
      case "auth/wrong-password":
        return "Incorrect password";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/user-disabled":
        return "This account has been disabled";
      case "auth/email-already-in-use":
        return "An account with this email already exists";
      case "auth/weak-password":
        return "Password is too weak";
      case "auth/network-request-failed":
        return "Network error. Please check your connection";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later";
      case "auth/invalid-credential":
        return "Invalid email or password";
      default:
        return error.message || "An unexpected error occurred";
    }
  }
}

// Export Firebase services and auth instance
export { auth, firestore };
export const firebaseClientAuth = FirebaseClientAuth.getInstance();

// Export auth service for easier access
export const authService = firebaseClientAuth;
