import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

import { ENV } from "./env";

// Firebase Admin SDK configuration
interface FirebaseConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

const resolveFirebaseConfig = (): FirebaseConfig => {
    const privateKey = ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    console.log("[Firebase] Private key starts with:", privateKey.substring(0, 40));
    console.log("[Firebase] Private key ends with:", privateKey.slice(-40));
    return {
        projectId: ENV.FIREBASE_PROJECT_ID,
        clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
        privateKey,
    };
};

// Initialize Firebase Admin SDK
let firebaseApp: App;
let firebaseAuth: Auth;
let firebaseFirestore: Firestore;

try {
    const config = resolveFirebaseConfig();

    if (getApps().length === 0) {
        firebaseApp = initializeApp({
            credential: cert({
                projectId: config.projectId,
                clientEmail: config.clientEmail,
                privateKey: config.privateKey,
            }),
            projectId: config.projectId,
        });

        console.log("✅ Firebase Admin SDK initialized");
    } else {
        firebaseApp = getApps()[0];
        console.log("✅ Firebase Admin SDK already initialized");
    }

    firebaseAuth = getAuth(firebaseApp);
    firebaseFirestore = getFirestore(firebaseApp);

    firebaseFirestore.settings({
        ignoreUndefinedProperties: true,
    });
} catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    throw error;
}

// Exports
export { firebaseApp, firebaseAuth, firebaseFirestore };

export const checkFirebaseConnection = async (): Promise<boolean> => {
    try {
        await firebaseFirestore.collection("_health_check").limit(1).get();
        return true;
    } catch (error) {
        console.error("Firebase connection check failed:", error);
        return false;
    }
};
