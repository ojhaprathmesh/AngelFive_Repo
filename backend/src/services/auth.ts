import { firebaseAuth, firebaseFirestore } from "../config/firebase";
import { UserRecord } from "firebase-admin/auth";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

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
      console.error("Error creating user:", error);
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
  async signInUser(email: string, password: string): Promise<AuthResult> {
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

      // Update last login time
      await this.updateLastLoginTime(userRecord.uid);

      // Get user profile from Firestore
      const userProfile = await this.getUserProfile(userRecord.uid);

      return {
        success: true,
        user: userProfile || undefined,
      };
    } catch (error: any) {
      console.error("Error signing in user:", error);
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
      const [userRecord, userDoc] = await Promise.all([
        firebaseAuth.getUser(uid),
        firebaseFirestore.collection(this.usersCollection).doc(uid).get(),
      ]);

      if (!userDoc.exists) {
        // Create profile if it doesn't exist
        return await this.createUserProfile(userRecord);
      }

      const userData = userDoc.data();
      return this.mapToUserProfile(userRecord, userData);
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>,
  ): Promise<boolean> {
    try {
      const updateData = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await firebaseFirestore
        .collection(this.usersCollection)
        .doc(uid)
        .update(updateData);
      return true;
    } catch (error) {
      console.error("Error updating user profile:", error);
      return false;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(uid: string): Promise<boolean> {
    try {
      // Delete from Firebase Auth
      await firebaseAuth.deleteUser(uid);

      // Delete from Firestore
      await firebaseFirestore
        .collection(this.usersCollection)
        .doc(uid)
        .delete();

      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  /**
   * Verify user email
   */
  async verifyUserEmail(uid: string): Promise<boolean> {
    try {
      await firebaseAuth.updateUser(uid, { emailVerified: true });
      await this.updateUserProfile(uid, { emailVerified: true });
      return true;
    } catch (error) {
      console.error("Error verifying user email:", error);
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
   * Create user profile in Firestore
   */
  public async createUserProfile(
    userRecord: UserRecord,
    fullName?: string,
  ): Promise<UserProfile> {
    const now = Timestamp.now();

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
      .doc(userRecord.uid)
      .set(userProfile);
    const wlCol = firebaseFirestore
      .collection(this.usersCollection)
      .doc(userRecord.uid)
      .collection("watchlists");
    const defDoc = wlCol.doc("default");
    await defDoc.set(
      { name: "Default", createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const symCol = defDoc.collection("symbols");
    const symSnap = await symCol.limit(1).get();
    if (symSnap.empty) {
      const samples = [
        { symbol: "IDEA", exchange: "NSE", ltp: 9.97, changePct: -1.97 },
        { symbol: "JIOFIN", exchange: "NSE", ltp: 253.4, changePct: 0.85 },
        { symbol: "TATASTEEL", exchange: "NSE", ltp: 132.75, changePct: -0.62 },
        { symbol: "TATAPOWER", exchange: "NSE", ltp: 108.9, changePct: 1.25 },
        { symbol: "YESBANK", exchange: "NSE", ltp: 22.15, changePct: -0.35 },
      ];
      const batch = firebaseFirestore.batch();
      samples.forEach((s) => {
        const ref = symCol.doc(s.symbol);
        batch.set(
          ref,
          {
            symbol: s.symbol,
            exchange: s.exchange,
            ltp: s.ltp,
            changePct: s.changePct,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
      await batch.commit();
    }

    return userProfile;
  }

  /**
   * Update last login time
   */
  private async updateLastLoginTime(uid: string): Promise<void> {
    try {
      await firebaseFirestore.collection(this.usersCollection).doc(uid).update({
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating last login time:", error);
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
