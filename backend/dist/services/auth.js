"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.FirebaseAuthService = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
class FirebaseAuthService {
    constructor() {
        Object.defineProperty(this, "usersCollection", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "users"
        });
    }
    static getInstance() {
        if (!FirebaseAuthService.instance) {
            FirebaseAuthService.instance = new FirebaseAuthService();
        }
        return FirebaseAuthService.instance;
    }
    async createUser(userData) {
        try {
            const userRecord = await firebase_1.firebaseAuth.createUser({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName || userData.fullName,
                emailVerified: userData.emailVerified || false,
            });
            const userProfile = await this.createUserProfile(userRecord, userData.fullName);
            return {
                success: true,
                user: userProfile || undefined,
            };
        }
        catch (error) {
            console.error("Error creating user:", error);
            return {
                success: false,
                error: error.message || "Failed to create user",
                errorCode: error.code,
            };
        }
    }
    async signInUser(email, password) {
        try {
            const userRecord = await firebase_1.firebaseAuth.getUserByEmail(email);
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
            const userProfile = await this.getUserProfile(userRecord.uid);
            return {
                success: true,
                user: userProfile || undefined,
            };
        }
        catch (error) {
            console.error("Error signing in user:", error);
            return {
                success: false,
                error: error.message || "Authentication failed",
                errorCode: error.code,
            };
        }
    }
    async getUserProfile(uid) {
        try {
            const [userRecord, userDoc] = await Promise.all([
                firebase_1.firebaseAuth.getUser(uid),
                firebase_1.firebaseFirestore.collection(this.usersCollection).doc(uid).get(),
            ]);
            if (!userDoc.exists) {
                return await this.createUserProfile(userRecord);
            }
            const userData = userDoc.data();
            return this.mapToUserProfile(userRecord, userData);
        }
        catch (error) {
            console.error("Error getting user profile:", error);
            return null;
        }
    }
    async updateUserProfile(uid, updates) {
        try {
            const updateData = {
                ...updates,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            await firebase_1.firebaseFirestore
                .collection(this.usersCollection)
                .doc(uid)
                .update(updateData);
            return true;
        }
        catch (error) {
            console.error("Error updating user profile:", error);
            return false;
        }
    }
    async deleteUser(uid) {
        try {
            await firebase_1.firebaseAuth.deleteUser(uid);
            await firebase_1.firebaseFirestore
                .collection(this.usersCollection)
                .doc(uid)
                .delete();
            return true;
        }
        catch (error) {
            console.error("Error deleting user:", error);
            return false;
        }
    }
    async verifyUserEmail(uid) {
        try {
            await firebase_1.firebaseAuth.updateUser(uid, { emailVerified: true });
            await this.updateUserProfile(uid, { emailVerified: true });
            return true;
        }
        catch (error) {
            console.error("Error verifying user email:", error);
            return false;
        }
    }
    async emailExists(email) {
        try {
            await firebase_1.firebaseAuth.getUserByEmail(email);
            return true;
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                return false;
            }
            throw error;
        }
    }
    async createUserProfile(userRecord, fullName) {
        const now = firestore_1.Timestamp.now();
        const userProfile = {
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
        await firebase_1.firebaseFirestore
            .collection(this.usersCollection)
            .doc(userRecord.uid)
            .set(userProfile);
        return userProfile;
    }
    async updateLastLoginTime(uid) {
        try {
            await firebase_1.firebaseFirestore.collection(this.usersCollection).doc(uid).update({
                lastLoginAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (error) {
            console.error("Error updating last login time:", error);
        }
    }
    mapToUserProfile(userRecord, firestoreData) {
        return {
            uid: userRecord.uid,
            email: userRecord.email || "",
            fullName: firestoreData?.fullName || userRecord.displayName || "",
            displayName: userRecord.displayName || undefined,
            photoURL: userRecord.photoURL || undefined,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            createdAt: firestoreData?.createdAt || firestore_1.Timestamp.now(),
            updatedAt: firestoreData?.updatedAt || firestore_1.Timestamp.now(),
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
exports.FirebaseAuthService = FirebaseAuthService;
exports.authService = FirebaseAuthService.getInstance();
//# sourceMappingURL=auth.js.map