import { createHash } from "crypto";
import { UserRecord } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { firebaseAuth, firebaseFirestore } from "../config/firebase";
import { logger } from "../lib/logger";
import { watchlistRepository } from "../repositories/watchlist.repository";

// Standardized user data schema following Firebase best practices
export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  metadata: {
    creationTime: string;
    lastSignInTime?: string;
    lastRefreshTime?: string;
  };
  customClaims?: Record<string, any>;
  providerData: Array<{
    uid: string;
    email?: string;
    providerId: string;
    displayName?: string;
    photoURL?: string;
  }>;
}

// User creation request interface
export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  displayName?: string;
  emailVerified?: boolean;
}

// User authentication result
export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  errorCode?: string;
}

// Firebase Authentication Service
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private readonly usersCollection = "users";

  private constructor() {}

  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  /**
   * Generates a deterministic document ID from a name + uid.
   * Format: "prathmesh-ojha-a3kR9mZx"
   * The name prefix is human-readable; the 8-char base62 hash suffix guarantees uniqueness.
   *
   * Example: ("Prathmesh Ojha", "iAmAHash1234...") → "prathmesh-ojha-a3kR9mZx"
   */
  private generateSlug(name: string, uid: string): string {
    const nameSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-");

    const hash = createHash("sha256").update(uid).digest();
    const chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let hashSuffix = "";
    for (let i = 0; i < 8; i++) {
      hashSuffix += chars[hash[i] % 62];
    }

    return `${nameSlug}-${hashSuffix}`;
  }

  /**
   * Create a new user with email and password
   */
  async createUser(userData: CreateUserRequest): Promise<AuthResult> {
    try {
      // Create user in Firebase Auth
      const userRecord = await firebaseAuth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName || userData.fullName,
        emailVerified: userData.emailVerified || false,
      });

      // Create user profile in Firestore
      const userProfile = await this.createUserProfile(
        userRecord,
        userData.fullName,
      );

      return {
        success: true,
        user: userProfile || undefined,
      };
    } catch (error: any) {
      logger.error({ err: error }, "Error creating user:");
      return {
        success: false,
        error: error.message || "Failed to create user",
        errorCode: error.code,
      };
    }
  }

  /**
   * Authenticate user with email and password
   */
  async signInUser(email: string): Promise<AuthResult> {
    try {
      // Get user by email
      const userRecord = await firebaseAuth.getUserByEmail(email);

      if (!userRecord) {
        return {
          success: false,
          error: "User not found",
          errorCode: "auth/user-not-found",
        };
      }

      if (userRecord.disabled) {
        return {
          success: false,
          error: "User account is disabled",
          errorCode: "auth/user-disabled",
        };
      }

      await this.updateLastLoginTime(userRecord.uid);

      // Get user profile from Firestore
      const userProfile = await this.getUserProfile(userRecord.uid);

      return {
        success: true,
        user: userProfile || undefined,
      };
    } catch (error: any) {
      logger.error({ err: error }, "Error signing in user:");
      return {
        success: false,
        error: error.message || "Authentication failed",
        errorCode: error.code,
      };
    }
  }

  /**
   * Get user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const [userRecord, snap] = await Promise.all([
        firebaseAuth.getUser(uid),
        firebaseFirestore
          .collection(this.usersCollection)
          .where("uid", "==", uid)
          .limit(1)
          .get(),
      ]);

      if (snap.empty) {
        // Profile doesn't exist yet — create it on the fly
        return await this.createUserProfile(userRecord);
      }

      const userData = snap.docs[0].data();
      return this.mapToUserProfile(userRecord, userData);
    } catch (error) {
      logger.error({ err: error }, "Error getting user profile:");
      return null;
    }
  }

  /**
   * Update user profile.
   * Finds the document by uid field first, then updates it.
   */
  async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>,
  ): Promise<boolean> {
    try {
      const snap = await firebaseFirestore
        .collection(this.usersCollection)
        .where("uid", "==", uid)
        .limit(1)
        .get();

      if (snap.empty) {
        logger.warn(`No profile found for uid: ${uid}`);
        return false;
      }

      await snap.docs[0].ref.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return true;
    } catch (error) {
      logger.error({ err: error }, "Error updating user profile:");
      return false;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      await firebaseAuth.getUserByEmail(email);
      return true;
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create user profile in Firestore.
   * Document ID is a deterministic 8-char base62 slug derived from the uid.
   * The uid is stored as a field inside the document for querying.
   */
  public async createUserProfile(
    userRecord: UserRecord,
    fullName?: string,
  ): Promise<UserProfile> {
    const now = Timestamp.now();
    const docId = this.generateSlug(
      fullName || userRecord.displayName || "user",
      userRecord.uid,
    );

    const userProfile: UserProfile = {
      uid: userRecord.uid,
      email: userRecord.email || "",
      fullName: fullName || userRecord.displayName || "",
      displayName: userRecord.displayName || undefined,
      photoURL: userRecord.photoURL || undefined,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      createdAt: now,
      updatedAt: now,
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime || undefined,
        lastRefreshTime: userRecord.metadata.lastRefreshTime || undefined,
      },
      customClaims: userRecord.customClaims || undefined,
      providerData: userRecord.providerData.map((provider) => ({
        uid: provider.uid,
        email: provider.email,
        providerId: provider.providerId,
        displayName: provider.displayName,
        photoURL: provider.photoURL,
      })),
    };

    // Save to Firestore
    await firebaseFirestore
      .collection(this.usersCollection)
      .doc(docId)
      .set(userProfile);

    // Ensure default watchlist with sample symbols
    await watchlistRepository.ensureDefaultWatchlist(docId);

    return userProfile;
  }

  /**
   * Update last login time
   */
  private async updateLastLoginTime(uid: string): Promise<void> {
    try {
      await this.updateUserProfile(uid, {
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      logger.error({ err: error }, "Error updating last login time:");
    }
  }

  /**
   * Map Firebase user record and Firestore data to UserProfile
   */
  private mapToUserProfile(
    userRecord: UserRecord,
    firestoreData?: any,
  ): UserProfile {
    return {
      uid: userRecord.uid,
      email: userRecord.email || "",
      fullName: firestoreData?.fullName || userRecord.displayName || "",
      displayName: userRecord.displayName || undefined,
      photoURL: userRecord.photoURL || undefined,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      createdAt: firestoreData?.createdAt || Timestamp.now(),
      updatedAt: firestoreData?.updatedAt || Timestamp.now(),
      lastLoginAt: firestoreData?.lastLoginAt || undefined,
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime || undefined,
        lastRefreshTime: userRecord.metadata.lastRefreshTime || undefined,
      },
      customClaims: userRecord.customClaims || undefined,
      providerData: userRecord.providerData.map((provider) => ({
        uid: provider.uid,
        email: provider.email,
        providerId: provider.providerId,
        displayName: provider.displayName,
        photoURL: provider.photoURL,
      })),
    };
  }
}

// Export singleton instance
export const authService = FirebaseAuthService.getInstance();
