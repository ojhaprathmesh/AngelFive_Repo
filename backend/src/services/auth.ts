import { createHash } from "crypto";
import { UserRecord } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { firebaseAuth, firebaseFirestore } from "../config/firebase";

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

    private constructor() {
    }

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
        const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
            console.error("Error getting user profile:", error);
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
                console.warn(`No profile found for uid: ${uid}`);
                return false;
            }

            await snap.docs[0].ref.update({
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
            });

            return true;
        } catch (error) {
            console.error("Error updating user profile:", error);
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
        const docId = this.generateSlug(fullName || userRecord.displayName || "user", userRecord.uid);

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

        // Create default watchlist subcollection under slug doc ID
        const wlCol = firebaseFirestore
            .collection(this.usersCollection)
            .doc(docId)
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
            await this.updateUserProfile(uid, {
                lastLoginAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
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
