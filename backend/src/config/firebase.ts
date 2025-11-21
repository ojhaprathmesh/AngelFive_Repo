import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import fs from "fs";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Firebase Admin SDK configuration
interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Environment variables validation
const resolveFirebaseConfig = (): FirebaseConfig => {
  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    const raw = fs.readFileSync(credentialsPath, "utf8");
    const json = JSON.parse(raw);
    const projectId: string | undefined = json.project_id;
    const clientEmail: string | undefined = json.client_email;
    const privateKey: string | undefined = json.private_key;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Invalid credentials JSON. Missing project_id, client_email or private_key."
      );
    }
    return { projectId, clientEmail, privateKey };
  }

  throw new Error(
    "Missing Firebase configuration. Provide FIREBASE_* env or a valid GOOGLE_APPLICATION_CREDENTIALS file."
  );
};

// Initialize Firebase Admin SDK
let firebaseApp: App;
let firebaseAuth: Auth;
let firebaseFirestore: Firestore;

try {
  const config = resolveFirebaseConfig();

  // Check if Firebase app is already initialized
  if (getApps().length === 0) {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      projectId: config.projectId,
    });

    console.log("✅ Firebase Admin SDK initialized successfully");
  } else {
    firebaseApp = getApps()[0];
    console.log("✅ Firebase Admin SDK already initialized");
  }

  // Initialize Firebase services
  firebaseAuth = getAuth(firebaseApp);
  firebaseFirestore = getFirestore(firebaseApp);

  // Configure Firestore settings
  firebaseFirestore.settings({
    ignoreUndefinedProperties: true,
  });
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error);
  throw error;
}

// Export Firebase services
export { firebaseApp, firebaseAuth, firebaseFirestore };

// Export types for better TypeScript support
export type { Auth as FirebaseAuth, Firestore as FirebaseFirestore };

// Health check function
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Test Firestore connection
    await firebaseFirestore.collection("_health_check").limit(1).get();
    return true;
  } catch (error) {
    console.error("Firebase connection check failed:", error);
    return false;
  }
};
